import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { VerificationAccessService } from './verification-access.service.js';
import { BorrowerCheckRunsService } from './borrower-check-runs.service.js';
import { VerificationAdaptersRegistry } from './verification-adapters.registry.js';
import { resultInput } from './verification-results.js';
import { jsonSafe } from './verification.validation.js';
@Injectable()
export class BorrowerChecksWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private stopping = false;
  private controller?: AbortController;
  private readonly logger = new Logger(BorrowerChecksWorker.name);
  constructor(
    private readonly access: VerificationAccessService,
    private readonly runs: BorrowerCheckRunsService,
    private readonly adapters: VerificationAdaptersRegistry,
  ) {}
  onApplicationBootstrap() {
    if (process.env.VERIFICATION_WORKER_ENABLED === 'false') return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 2000);
    this.timer.unref();
  }
  onApplicationShutdown() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.controller?.abort();
  }
  private async tick() {
    if (this.busy || this.stopping) return;
    this.busy = true;
    try {
      await this.recoverExpired();
      await this.processOne();
    } catch {
      this.logger.error(
        'Не удалось обработать очередь проверок; персональные данные исключены из журнала',
      );
    } finally {
      this.busy = false;
    }
  }
  async recoverExpired() {
    const expired = await this.access.db.borrowerCheckRun.findMany({
      where: {
        status: 'RUNNING',
        mode: 'AUTOMATIC',
        leaseExpiresAt: { lte: new Date() },
      },
      select: { id: true, verificationId: true },
      take: 20,
    });
    for (const candidate of expired)
      await this.access.transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM borrower_verifications WHERE id=${candidate.verificationId} FOR UPDATE`,
        );
        const run = await tx.borrowerCheckRun.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        if (
          run.status !== 'RUNNING' ||
          !run.leaseExpiresAt ||
          run.leaseExpiresAt > new Date()
        )
          return;
        await tx.borrowerCheckRun.update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            errorCode: 'WORKER_LEASE_EXPIRED',
            errorMessage: 'Обработка прервана. Запустите проверку повторно.',
            finishedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        await tx.borrowerVerificationItem.update({
          where: { id: run.itemId },
          data: { status: 'ERROR' },
        });
        await tx.borrowerVerification.update({
          where: { id: run.verificationId },
          data: { updatedAt: new Date() },
        });
        await this.runs.refreshOverall(tx, run.verificationId);
        await this.access.audit(
          tx,
          null,
          run.workspaceId,
          'VERIFICATION_CHECK_INTERRUPTED',
          run.verificationId,
          { runId: run.id },
        );
      });
  }
  async processOne() {
    const candidate = await this.access.db.borrowerCheckRun.findFirst({
      where: {
        status: 'QUEUED',
        mode: 'AUTOMATIC',
        availableAt: { lte: new Date() },
      },
      orderBy: [{ availableAt: 'asc' }, { id: 'asc' }],
    });
    if (!candidate) return false;
    const owner = randomUUID();
    const claimed = await this.access.transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM borrower_verifications WHERE id=${candidate.verificationId} FOR UPDATE`,
      );
      const locked = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM borrower_check_runs WHERE id=${candidate.id} AND status='QUEUED' FOR UPDATE SKIP LOCKED`,
      );
      if (!locked.length) return null;
      const row = await tx.borrowerVerification.findUniqueOrThrow({
        where: { id: candidate.verificationId },
      });
      if (['COMPLETED', 'CANCELLED'].includes(row.status)) return null;
      const run = await tx.borrowerCheckRun.update({
        where: { id: candidate.id },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          leaseOwner: owner,
          leaseExpiresAt: new Date(Date.now() + 90000),
          heartbeatAt: new Date(),
        },
      });
      await tx.borrowerVerificationItem.update({
        where: { id: run.itemId },
        data: { status: 'RUNNING' },
      });
      return run;
    });
    if (!claimed) return false;
    const heartbeat = setInterval(() => {
      void this.access
        .transaction(async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM borrower_verifications WHERE id=${claimed.verificationId} FOR UPDATE`,
          );
          await tx.borrowerCheckRun.updateMany({
            where: { id: claimed.id, status: 'RUNNING', leaseOwner: owner },
            data: {
              leaseExpiresAt: new Date(Date.now() + 90000),
              heartbeatAt: new Date(),
            },
          });
        })
        .catch(() => {});
    }, 10000);
    heartbeat.unref();
    this.controller = new AbortController();
    const signal = AbortSignal.any([
      this.controller.signal,
      AbortSignal.timeout(45000),
    ]);
    try {
      const adapter = this.adapters.forRun(claimed);
      if (!adapter) throw new Error('UNAVAILABLE');
      const result = await Promise.race([
        adapter.execute(claimed.inputSnapshot as Prisma.JsonObject, signal),
        new Promise<never>((_, reject) =>
          signal.addEventListener('abort', () => reject(new Error('TIMEOUT')), {
            once: true,
          }),
        ),
      ]);
      const normalized = resultInput(jsonSafe(result));
      await this.access.transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM borrower_verifications WHERE id=${claimed.verificationId} FOR UPDATE`,
        );
        const current = await tx.borrowerCheckRun.findUniqueOrThrow({
          where: { id: claimed.id },
        });
        if (current.status !== 'RUNNING' || current.leaseOwner !== owner)
          return;
        const verification = await tx.borrowerVerification.findUniqueOrThrow({
          where: { id: claimed.verificationId },
        });
        await this.runs.saveResult(
          tx,
          current,
          normalized,
          verification.createdById,
        );
        await tx.borrowerVerification.update({
          where: { id: verification.id },
          data: { updatedAt: new Date() },
        });
        await this.access.audit(
          tx,
          null,
          claimed.workspaceId,
          'VERIFICATION_CHECK_SUCCEEDED',
          verification.id,
          { runId: claimed.id },
        );
      });
    } catch {
      await this.access.transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM borrower_verifications WHERE id=${claimed.verificationId} FOR UPDATE`,
        );
        const current = await tx.borrowerCheckRun.findUniqueOrThrow({
          where: { id: claimed.id },
        });
        if (current.status !== 'RUNNING' || current.leaseOwner !== owner)
          return;
        await tx.borrowerCheckRun.update({
          where: { id: claimed.id },
          data: {
            status: 'FAILED',
            finishedAt: new Date(),
            errorCode: signal.aborted ? 'SOURCE_TIMEOUT' : 'SOURCE_ERROR',
            errorMessage:
              'Не удалось получить или проверить ответ источника. Попробуйте повторить запрос.',
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        await tx.borrowerVerificationItem.update({
          where: { id: claimed.itemId },
          data: { status: 'ERROR' },
        });
        await tx.borrowerVerification.update({
          where: { id: claimed.verificationId },
          data: { updatedAt: new Date() },
        });
        await this.runs.refreshOverall(tx, claimed.verificationId);
        await this.access.audit(
          tx,
          null,
          claimed.workspaceId,
          'VERIFICATION_CHECK_FAILED',
          claimed.verificationId,
          { runId: claimed.id },
        );
      });
    } finally {
      clearInterval(heartbeat);
      this.controller = undefined;
    }
    return true;
  }
}
