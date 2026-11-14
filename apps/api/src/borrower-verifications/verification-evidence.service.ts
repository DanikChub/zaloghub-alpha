import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  VerificationAccessService,
  type Tx,
} from './verification-access.service.js';
import {
  DocumentStorageService,
  type VerificationUpload,
} from './document-storage.service.js';
import {
  choice,
  date,
  object,
  text,
  timestamp,
} from './verification.validation.js';
import { httpUrl } from './verification-results.js';
import type { BorrowerEvidenceKind } from '../generated/prisma/client.js';
@Injectable()
export class VerificationEvidenceService {
  constructor(
    private readonly access: VerificationAccessService,
    readonly storage: DocumentStorageService,
  ) {}
  async scope(
    tx: Tx,
    verificationId: string,
    workspaceId: string,
    v: Record<string, unknown>,
  ) {
    const itemId = text(v.itemId, 'itemId', false, 100),
      runId = text(v.runId, 'runId', false, 100),
      findingId = text(v.findingId, 'findingId', false, 100);
    if ((runId && !itemId) || (findingId && !runId))
      throw new BadRequestException(
        'Не указана родительская связь доказательства',
      );
    if (itemId) await this.access.item(tx, verificationId, itemId);
    if (
      runId &&
      !(await tx.borrowerCheckRun.findFirst({
        where: { id: runId, itemId, verificationId, workspaceId },
      }))
    )
      throw new NotFoundException('Запуск не найден');
    if (
      findingId &&
      !(await tx.borrowerCheckFinding.findFirst({
        where: { id: findingId, runId, verificationId, workspaceId },
      }))
    )
      throw new NotFoundException('Найденная запись не найдена');
    return { itemId, runId, findingId };
  }
  private fields(body: unknown) {
    const v = object(body, [
      'kind',
      'title',
      'itemId',
      'runId',
      'findingId',
      'issuedOn',
      'capturedAt',
      'validUntil',
      'sourceUrl',
    ]);
    return {
      v,
      kind: choice<BorrowerEvidenceKind>(
        v.kind,
        [
          'PASSPORT',
          'SNILS',
          'CERTIFICATE',
          'EXTRACT',
          'SCREENSHOT',
          'PROVIDER_RESPONSE',
          'OTHER',
        ],
        'kind',
      ),
      title: text(v.title, 'title', true, 500)!,
      issuedOn: date(v.issuedOn, 'issuedOn'),
      capturedAt: timestamp(v.capturedAt, 'capturedAt'),
      validUntil: timestamp(v.validUntil, 'validUntil'),
      sourceUrl: httpUrl(v.sourceUrl),
    };
  }
  async upload(
    actor: string,
    id: string,
    body: unknown,
    file: VerificationUpload,
  ) {
    const parsed = this.fields(body);
    await this.access.verification(this.access.db, actor, id, 'write');
    const saved = await this.storage.save(file);
    try {
      return await this.access.write(actor, id, async (tx, row) => {
        const scope = await this.scope(tx, id, row.workspaceId, parsed.v);
        const document = await tx.document.create({
          data: { workspaceId: row.workspaceId, ...saved },
        });
        const { v, ...fields } = parsed;
        void v;
        const evidence = await tx.borrowerVerificationEvidence.create({
          data: {
            workspaceId: row.workspaceId,
            verificationId: id,
            ...scope,
            ...fields,
            documentId: document.id,
            uploadedById: actor,
          },
        });
        await this.access.audit(
          tx,
          actor,
          row.workspaceId,
          'VERIFICATION_EVIDENCE_UPLOADED',
          id,
          { evidenceId: evidence.id },
        );
        return { ...evidence, document };
      });
    } catch (error) {
      await this.storage.remove(saved.storageKey);
      throw error;
    }
  }
  async addLink(actor: string, id: string, body: unknown) {
    const parsed = this.fields(body);
    if (!parsed.sourceUrl) throw new BadRequestException('Укажите sourceUrl');
    return this.access.write(actor, id, async (tx, row) => {
      const scope = await this.scope(tx, id, row.workspaceId, parsed.v);
      const { v, ...fields } = parsed;
      void v;
      const evidence = await tx.borrowerVerificationEvidence.create({
        data: {
          workspaceId: row.workspaceId,
          verificationId: id,
          ...scope,
          ...fields,
          uploadedById: actor,
        },
      });
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_EVIDENCE_LINKED',
        id,
        { evidenceId: evidence.id },
      );
      return evidence;
    });
  }
  async list(actor: string, id: string) {
    await this.access.verification(this.access.db, actor, id);
    return this.access.db.borrowerVerificationEvidence.findMany({
      where: { verificationId: id },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  async get(actor: string, id: string, evidenceId: string) {
    await this.access.verification(this.access.db, actor, id);
    const evidence =
      await this.access.db.borrowerVerificationEvidence.findFirst({
        where: { id: evidenceId, verificationId: id },
        include: { document: true },
      });
    if (!evidence) throw new NotFoundException('Доказательство не найдено');
    return evidence;
  }
  async download(actor: string, id: string, evidenceId: string) {
    const evidence = await this.get(actor, id, evidenceId);
    if (!evidence.document) throw new NotFoundException('Файл не приложен');
    return {
      content: await this.storage.read(evidence.document.storageKey),
      mimeType: evidence.document.mimeType,
      name: evidence.document.originalFilename ?? 'document',
    };
  }
  review(actor: string, id: string, evidenceId: string, body: unknown) {
    const v = object(body, ['status', 'comment']);
    const authenticityStatus = choice(
      v.status,
      ['CONFIRMED', 'DOUBTFUL', 'REJECTED'] as const,
      'status',
    );
    const reviewComment = text(v.comment, 'comment')!;
    return this.access.write(actor, id, async (tx, row) => {
      if (
        !(await tx.borrowerVerificationEvidence.findFirst({
          where: { id: evidenceId, verificationId: id },
        }))
      )
        throw new NotFoundException('Доказательство не найдено');
      const result = await tx.borrowerVerificationEvidence.update({
        where: { id: evidenceId },
        data: {
          authenticityStatus,
          reviewComment,
          reviewedById: actor,
          reviewedAt: new Date(),
        },
      });
      if (result.itemId && result.runId) {
        const item = await tx.borrowerVerificationItem.findUniqueOrThrow({
          where: { id: result.itemId },
        });
        if (item.acceptedRunId === result.runId)
          await tx.borrowerVerificationItem.update({
            where: { id: item.id },
            data: { status: 'STALE' },
          });
      }
      await tx.borrowerVerification.update({
        where: { id },
        data: { overallRisk: 'NOT_ASSESSED' },
      });
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_EVIDENCE_REVIEWED',
        id,
        { evidenceId, status: authenticityStatus },
      );
      return result;
    });
  }
  async recognize(actor: string, id: string, evidenceId: string) {
    const row = await this.access.verification(
      this.access.db,
      actor,
      id,
      'write',
    );
    this.access.mutable(row);
    const evidence = await this.get(actor, id, evidenceId);
    if (!evidence.documentId)
      throw new BadRequestException('Для распознавания нужен файл');
    throw new ServiceUnavailableException({
      code: 'OCR_NOT_CONFIGURED',
      message:
        'Распознавание паспорта пока не подключено. Введите и подтвердите данные вручную',
    });
  }
}
