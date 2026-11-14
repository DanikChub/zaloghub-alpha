import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Prisma,
  type BorrowerCheckRun,
  type BorrowerVerification,
} from '../generated/prisma/client.js';
import {
  VerificationAccessService,
  type Tx,
} from './verification-access.service.js';
import { BorrowerVerificationsService } from './borrower-verifications.service.js';
import { VerificationRiskService } from './verification-risk.service.js';
import { VerificationAdaptersRegistry } from './verification-adapters.registry.js';
import { definition, missingFields } from './verification.checklist.js';
import {
  resultInput,
  validateResult,
  type ResultInput,
} from './verification-results.js';
import {
  choice,
  hash,
  json,
  key,
  object,
  text,
  jsonSafe,
} from './verification.validation.js';
@Injectable()
export class BorrowerCheckRunsService {
  constructor(
    readonly access: VerificationAccessService,
    private readonly verifications: BorrowerVerificationsService,
    private readonly risks: VerificationRiskService,
    readonly adapters: VerificationAdaptersRegistry,
  ) {}
  refreshOverall(tx: Tx, id: string) {
    return this.verifications.overall(tx, id);
  }
  async listItems(actor: string, id: string) {
    await this.access.verification(this.access.db, actor, id);
    return this.access.db.borrowerVerificationItem.findMany({
      where: { verificationId: id },
      include: { acceptedRun: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
  async item(actor: string, id: string, itemId: string) {
    await this.access.verification(this.access.db, actor, id);
    const item = await this.access.item(this.access.db, id, itemId);
    return {
      ...item,
      readiness: (await this.verifications.readiness(actor, id)).items.find(
        (x) => x.itemId === itemId,
      ),
    };
  }
  async context(actor: string, id: string, itemId: string) {
    const row = await this.access.verification(this.access.db, actor, id);
    const item = await this.access.item(this.access.db, id, itemId);
    const identity = row.identityVersionId
      ? await this.access.db.partyIdentityVersion.findUnique({
          where: { id: row.identityVersionId },
        })
      : null;
    const values: Record<string, string | undefined> = {
      fullName: identity
        ? [identity.lastName, identity.firstName, identity.middleName]
            .filter(Boolean)
            .join(' ')
        : undefined,
      birthDate: identity?.birthDate?.toISOString().slice(0, 10),
      passportSeries: identity?.passportSeries ?? undefined,
      passportNumber: identity?.passportNumber ?? undefined,
      inn: identity?.inn ?? undefined,
      snils: identity?.snils ?? undefined,
      ogrnip: identity?.ogrnip ?? undefined,
    };
    return {
      sourceUrl: item.sourceUrl,
      instructions: item.instructions,
      resultSchema: item.resultSchema,
      copyFields: Object.entries(values)
        .filter(([, value]) => value !== undefined)
        .map(([field, value]) => ({ key: field, value })),
      previousNames: identity?.previousNames ?? [],
      missingFields: missingFields(definition(item.checkCode)!, identity),
    };
  }
  async run(actor: string, id: string, itemId: string, runId: string) {
    await this.access.verification(this.access.db, actor, id);
    await this.access.item(this.access.db, id, itemId);
    const run = await this.access.db.borrowerCheckRun.findFirst({
      where: { id: runId, itemId, verificationId: id },
      include: {
        findings: true,
        risks: true,
        evidence: { include: { document: true } },
      },
    });
    if (!run) throw new NotFoundException('Запуск не найден');
    return run;
  }
  async history(actor: string, id: string, itemId: string) {
    await this.item(actor, id, itemId);
    return this.access.db.borrowerCheckRun.findMany({
      where: { verificationId: id, itemId },
      orderBy: { attemptNo: 'desc' },
      take: 100,
    });
  }
  private async nextAttempt(tx: Tx, itemId: string) {
    return (
      (
        await tx.borrowerCheckRun.aggregate({
          where: { itemId },
          _max: { attemptNo: true },
        })
      )._max.attemptNo ?? 0
    );
  }
  private async confirmedIdentity(
    tx: Tx,
    row: BorrowerVerification,
    code: string,
  ) {
    if (!row.identityVersionId)
      throw new ConflictException({
        code: 'MISSING_DATA',
        missingFields: ['identity'],
      });
    const identity = await tx.partyIdentityVersion.findUniqueOrThrow({
      where: { id: row.identityVersionId },
    });
    const missing = missingFields(definition(code)!, identity);
    if (missing.length)
      throw new ConflictException({
        code: 'MISSING_DATA',
        missingFields: missing,
      });
    return identity;
  }
  async enqueueOne(
    tx: Tx,
    row: BorrowerVerification,
    itemId: string,
    idempotencyKey: string,
  ) {
    const item = await this.access.item(tx, row.id, itemId);
    if (process.env.VERIFICATION_WORKER_ENABLED === 'false')
      throw new ServiceUnavailableException({
        code: 'WORKER_DISABLED',
        message: 'Обработка автоматических проверок отключена',
      });
    const adapter = this.adapters.get(item.checkCode);
    if (!adapter)
      throw new ServiceUnavailableException({
        code: 'INTEGRATION_NOT_CONFIGURED',
        message: 'Автопроверка пока не подключена. Доступна ручная проверка',
      });
    const existing = await tx.borrowerCheckRun.findUnique({
      where: { itemId_idempotencyKey: { itemId, idempotencyKey } },
    });
    if (existing) {
      if (existing.mode !== 'AUTOMATIC')
        throw new ConflictException('Ключ уже использован для ручной проверки');
      return existing;
    }
    const identity = await this.confirmedIdentity(tx, row, item.checkCode);
    if (
      await tx.borrowerCheckRun.count({
        where: { itemId, status: { in: ['QUEUED', 'RUNNING'] } },
      })
    )
      throw new ConflictException('Проверка уже запущена');
    const inputSnapshot = jsonSafe({ identity, checkCode: item.checkCode });
    const run = await tx.borrowerCheckRun.create({
      data: {
        workspaceId: row.workspaceId,
        verificationId: row.id,
        itemId,
        identityVersionId: identity.id,
        attemptNo: (await this.nextAttempt(tx, itemId)) + 1,
        mode: 'AUTOMATIC',
        providerCode: adapter.providerCode,
        adapterVersion: adapter.version,
        idempotencyKey,
        inputSnapshot: json(inputSnapshot),
        inputHash: hash(inputSnapshot),
        assessmentRulesVersion: row.riskRulesVersion,
      },
    });
    await tx.borrowerVerificationItem.update({
      where: { id: itemId },
      data: { status: 'QUEUED' },
    });
    return run;
  }
  enqueue(actor: string, id: string, itemId: string, header: unknown) {
    const idempotencyKey = key(header);
    return this.access.write(actor, id, async (tx, row) => {
      const run = await this.enqueueOne(tx, row, itemId, idempotencyKey);
      await tx.borrowerVerification.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      });
      await this.verifications.overall(tx, id);
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_CHECK_QUEUED',
        id,
        { runId: run.id },
      );
      return run;
    });
  }
  bulk(actor: string, id: string, header: unknown) {
    const prefix = key(header);
    return this.access.write(actor, id, async (tx, row) => {
      const items = await tx.borrowerVerificationItem.findMany({
        where: { verificationId: id },
        orderBy: { sortOrder: 'asc' },
      });
      const started: BorrowerCheckRun[] = [],
        skipped: { itemId: string; code: string; missingFields?: string[] }[] =
          [];
      for (const item of items) {
        if (!this.adapters.supports(item.checkCode)) {
          skipped.push({ itemId: item.id, code: 'INTEGRATION_NOT_CONFIGURED' });
          continue;
        }
        if (process.env.VERIFICATION_WORKER_ENABLED === 'false') {
          skipped.push({ itemId: item.id, code: 'WORKER_DISABLED' });
          continue;
        }
        const identity = row.identityVersionId
          ? await tx.partyIdentityVersion.findUnique({
              where: { id: row.identityVersionId },
            })
          : null;
        const missing = missingFields(definition(item.checkCode)!, identity);
        if (missing.length) {
          skipped.push({
            itemId: item.id,
            code: 'MISSING_DATA',
            missingFields: missing,
          });
          continue;
        }
        const idem = hash({ prefix, itemId: item.id });
        const previous = await tx.borrowerCheckRun.findUnique({
          where: {
            itemId_idempotencyKey: { itemId: item.id, idempotencyKey: idem },
          },
        });
        if (
          !previous &&
          (await tx.borrowerCheckRun.count({
            where: { itemId: item.id, status: { in: ['QUEUED', 'RUNNING'] } },
          }))
        ) {
          skipped.push({ itemId: item.id, code: 'ALREADY_RUNNING' });
          continue;
        }
        started.push(await this.enqueueOne(tx, row, item.id, idem));
      }
      if (started.length)
        await tx.borrowerVerification.update({
          where: { id },
          data: { status: 'IN_PROGRESS' },
        });
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_BULK_CHECKS_REQUESTED',
        id,
        { started: started.map((r) => r.id) },
      );
      await this.verifications.overall(tx, id);
      return { started, skipped };
    });
  }
  async manual(
    actor: string,
    id: string,
    itemId: string,
    body: unknown,
    header: unknown,
  ) {
    const idempotencyKey = key(header),
      result = resultInput(body),
      requestHash = hash(jsonSafe(result));
    return this.access.write(actor, id, async (tx, row) => {
      const item = await this.access.item(tx, id, itemId);
      validateResult(item.checkCode, result);
      const existing = await tx.borrowerCheckRun.findUnique({
        where: { itemId_idempotencyKey: { itemId, idempotencyKey } },
      });
      if (existing) {
        if (
          existing.mode !== 'MANUAL' ||
          (existing.inputSnapshot as Prisma.JsonObject).manualRequestHash !==
            requestHash
        )
          throw new ConflictException(
            'Ключ идемпотентности использован с другими данными',
          );
        return existing;
      }
      const identity = await this.confirmedIdentity(tx, row, item.checkCode);
      if (!result.evidenceIds.length)
        throw new BadRequestException(
          'Приложите доказательство ручной проверки',
        );
      const inputSnapshot = jsonSafe({
        identity,
        checkCode: item.checkCode,
        manualRequestHash: requestHash,
      });
      const now = new Date();
      const run = await tx.borrowerCheckRun.create({
        data: {
          workspaceId: row.workspaceId,
          verificationId: id,
          itemId,
          identityVersionId: identity.id,
          attemptNo: (await this.nextAttempt(tx, itemId)) + 1,
          mode: 'MANUAL',
          status: 'RUNNING',
          createdAt: now,
          startedAt: now,
          performedById: actor,
          idempotencyKey,
          inputSnapshot: json(inputSnapshot),
          inputHash: hash(inputSnapshot),
          assessmentRulesVersion: row.riskRulesVersion,
        },
      });
      await this.saveResult(tx, run, result, actor);
      await tx.borrowerVerification.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      });
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_MANUAL_RESULT_RECORDED',
        id,
        { runId: run.id },
      );
      return tx.borrowerCheckRun.findUniqueOrThrow({
        where: { id: run.id },
        include: { findings: true, evidence: true },
      });
    });
  }
  async saveResult(
    tx: Tx,
    run: BorrowerCheckRun,
    result: ResultInput,
    actor: string,
  ) {
    const item = await this.access.item(tx, run.verificationId, run.itemId);
    validateResult(item.checkCode, result);
    for (const evidenceId of new Set(result.evidenceIds)) {
      const source = await tx.borrowerVerificationEvidence.findFirst({
        where: {
          id: evidenceId,
          verificationId: run.verificationId,
          workspaceId: run.workspaceId,
        },
      });
      if (!source)
        throw new NotFoundException(
          'Доказательство не найдено в этой проверке',
        );
      await tx.borrowerVerificationEvidence.create({
        data: {
          workspaceId: run.workspaceId,
          verificationId: run.verificationId,
          itemId: run.itemId,
          runId: run.id,
          documentId: source.documentId,
          kind: source.kind,
          title: source.title,
          sourceUrl: source.sourceUrl,
          issuedOn: source.issuedOn,
          capturedAt: source.capturedAt,
          validUntil: source.validUntil,
          authenticityStatus: source.authenticityStatus,
          reviewComment: source.reviewComment,
          reviewedById: source.reviewedById,
          reviewedAt: source.reviewedAt,
          uploadedById: actor,
        },
      });
    }
    const d = definition(item.checkCode)!;
    if (d.documentRequired || d.resultType === 'DOCUMENT')
      if (
        !(await tx.borrowerVerificationEvidence.count({
          where: { runId: run.id, documentId: { not: null } },
        }))
      )
        throw new BadRequestException(
          'Для этого пункта нужен документ, ссылка недостаточна',
        );
    for (const f of result.findings)
      await tx.borrowerCheckFinding.create({
        data: {
          ...f,
          workspaceId: run.workspaceId,
          verificationId: run.verificationId,
          runId: run.id,
          ...(['CONFIRMED', 'REJECTED'].includes(f.identityMatch) &&
          run.mode === 'MANUAL'
            ? { matchReviewedById: actor, matchReviewedAt: new Date() }
            : {}),
        },
      });
    await tx.borrowerCheckRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCEEDED',
        resultBoolean: result.resultBoolean,
        resultCode: result.resultCode,
        resultAmount: result.resultAmount,
        currency: result.currency,
        resultData: result.resultData,
        summary: result.summary,
        coverage: result.coverage,
        sourceAsOfAt: result.sourceAsOfAt,
        validUntil: result.validUntil,
        finishedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    await this.risks.evaluateRun(tx, run.id, actor);
    const owner = await tx.borrowerVerification.findUniqueOrThrow({
      where: { id: run.verificationId },
    });
    await tx.borrowerVerificationItem.update({
      where: { id: run.itemId },
      data: {
        status:
          owner.identityVersionId === run.identityVersionId
            ? 'AWAITING_REVIEW'
            : 'STALE',
      },
    });
    await this.verifications.overall(tx, run.verificationId);
  }
  accept(actor: string, id: string, itemId: string, runId: string) {
    return this.access.write(actor, id, async (tx, row) => {
      await this.access.item(tx, id, itemId);
      const run = await tx.borrowerCheckRun.findFirst({
        where: { id: runId, itemId, verificationId: id, status: 'SUCCEEDED' },
      });
      if (!run) throw new NotFoundException('Успешный запуск не найден');
      if (
        run.identityVersionId !== row.identityVersionId ||
        (run.validUntil && run.validUntil <= new Date())
      )
        throw new ConflictException('Результат устарел');
      if (
        await tx.borrowerCheckFinding.count({
          where: { runId, identityMatch: { in: ['UNKNOWN', 'POSSIBLE'] } },
        })
      )
        throw new ConflictException(
          'Разберите принадлежность найденных записей заёмщику',
        );
      const evidence = await tx.borrowerVerificationEvidence.findMany({
        where: { runId },
      });
      if (
        evidence.some(
          (e) =>
            ['DOUBTFUL', 'REJECTED'].includes(e.authenticityStatus) ||
            (e.documentId && e.authenticityStatus !== 'CONFIRMED') ||
            (e.validUntil && e.validUntil <= new Date()),
        )
      )
        throw new ConflictException(
          'Подтвердите документы и актуальность доказательств',
        );
      await this.risks.evaluateRun(tx, runId, actor);
      await tx.borrowerCheckRun.update({
        where: { id: runId },
        data: { reviewedById: actor, reviewedAt: new Date() },
      });
      const result = await tx.borrowerVerificationItem.update({
        where: { id: itemId },
        data: { acceptedRunId: runId, status: 'COMPLETED' },
      });
      await this.verifications.overall(tx, id);
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_RESULT_ACCEPTED',
        id,
        { itemId, runId },
      );
      return result;
    });
  }
  notApplicable(actor: string, id: string, itemId: string, body: unknown) {
    const v = object(body, ['reason']);
    const reason = text(v.reason, 'reason')!;
    return this.access.write(
      actor,
      id,
      async (tx, row) => {
        const target = await this.access.item(tx, id, itemId);
        if (target.isRequired)
          throw new BadRequestException(
            'Обязательную проверку нельзя пропустить',
          );
        if (
          await tx.borrowerCheckRun.count({
            where: { itemId, status: { in: ['QUEUED', 'RUNNING'] } },
          })
        )
          throw new ConflictException('Сначала завершите запуски');
        const result = await tx.borrowerVerificationItem.update({
          where: { id: itemId },
          data: {
            status: 'NOT_APPLICABLE',
            notApplicableReason: reason,
            acceptedRunId: null,
          },
        });
        await this.verifications.overall(tx, id);
        await this.access.audit(
          tx,
          actor,
          row.workspaceId,
          'VERIFICATION_ITEM_NOT_APPLICABLE',
          id,
          { itemId, reason },
        );
        return result;
      },
      'approve',
    );
  }
  async findings(actor: string, id: string, itemId: string, runId: string) {
    return (await this.run(actor, id, itemId, runId)).findings;
  }
  reviewFinding(
    actor: string,
    id: string,
    itemId: string,
    runId: string,
    findingId: string,
    body: unknown,
  ) {
    const v = object(body, ['identityMatch', 'matchBasis', 'comment']);
    const identityMatch = choice(
      v.identityMatch,
      ['CONFIRMED', 'POSSIBLE', 'REJECTED'] as const,
      'identityMatch',
    );
    const comment = text(v.comment, 'comment')!,
      matchBasis = json(v.matchBasis);
    return this.access.write(actor, id, async (tx, row) => {
      const finding = await tx.borrowerCheckFinding.findFirst({
        where: { id: findingId, runId, verificationId: id, run: { itemId } },
      });
      if (!finding) throw new NotFoundException('Найденная запись не найдена');
      const result = await tx.borrowerCheckFinding.update({
        where: { id: findingId },
        data: {
          identityMatch,
          matchBasis,
          matchComment: comment,
          matchReviewedById: actor,
          matchReviewedAt: new Date(),
        },
      });
      await this.risks.evaluateRun(tx, runId, actor);
      const item = await this.access.item(tx, id, itemId);
      if (item.acceptedRunId === runId)
        await tx.borrowerVerificationItem.update({
          where: { id: itemId },
          data: { status: 'STALE' },
        });
      await this.verifications.overall(tx, id);
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_FINDING_REVIEWED',
        id,
        { findingId, identityMatch },
      );
      return result;
    });
  }
}
