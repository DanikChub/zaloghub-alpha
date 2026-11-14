import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type BorrowerVerificationStatus,
  type BorrowerRiskAssessment,
} from '../generated/prisma/client.js';
import {
  VerificationAccessService,
  type Tx,
} from './verification-access.service.js';
import { VerificationAdaptersRegistry } from './verification-adapters.registry.js';
import {
  CHECKS,
  CHECKLIST_VERSION,
  RISK_RULES_VERSION,
  definition,
  missingFields,
} from './verification.checklist.js';
import {
  choice,
  object,
  page,
  text,
  timestamp,
  type Obj,
} from './verification.validation.js';
@Injectable()
export class BorrowerVerificationsService {
  constructor(
    readonly access: VerificationAccessService,
    readonly adapters: VerificationAdaptersRegistry,
  ) {}
  async seed(tx: Tx, workspaceId: string, verificationId: string) {
    await tx.borrowerVerificationItem.createMany({
      data: CHECKS.map((d, index) => ({
        workspaceId,
        verificationId,
        checkCode: d.code,
        definitionVersion: CHECKLIST_VERSION,
        title: d.title,
        sortOrder: index,
        isRequired: d.required,
        resultType: d.resultType,
        inputSchema: { requiredFields: d.fields },
        resultSchema: {
          type: d.resultType,
          categories: d.categories ?? [],
          documentRequired: d.documentRequired ?? d.resultType === 'DOCUMENT',
        },
        sourceCode: d.code,
        sourceUrl: d.url,
        instructions: d.instruction,
        executionMode: d.url ? 'HYBRID' : 'MANUAL',
      })),
    });
  }
  create(actor: string, body: unknown) {
    const v = object(body, [
      'workspaceId',
      'partyId',
      'borrowerId',
      'displayName',
      'dealId',
      'assignedToId',
    ]);
    const partyId = text(v.partyId, 'partyId', false, 100),
      borrowerId = text(v.borrowerId, 'borrowerId', false, 100);
    if (partyId && borrowerId)
      throw new BadRequestException('Выберите partyId либо borrowerId');
    return this.access.transaction(async (tx) => {
      const workspaceId = await this.access.personalWorkspace(
        tx,
        actor,
        text(v.workspaceId, 'workspaceId', false, 100),
      );
      let party = partyId
        ? await tx.party.findFirst({ where: { id: partyId, workspaceId } })
        : null;
      if (partyId && !party) throw new NotFoundException('Человек не найден');
      if (borrowerId) {
        const borrower = await tx.borrower.findFirst({
          where: { id: borrowerId, workspaceId },
        });
        if (!borrower) throw new NotFoundException('Заёмщик не найден');
        // Lock the legacy borrower before resolving its unique Party link.
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM borrowers WHERE id=${borrowerId} FOR UPDATE`,
        );
        party = await tx.party.findUnique({
          where: { legacyBorrowerId: borrowerId },
        });
        if (!party)
          party = await tx.party.create({
            data: {
              workspaceId,
              kind: 'PERSON',
              displayName: [
                borrower.lastName,
                borrower.firstName,
                borrower.middleName,
              ]
                .filter(Boolean)
                .join(' '),
              legacyBorrowerId: borrower.id,
            },
          });
      }
      if (!party)
        party = await tx.party.create({
          data: {
            workspaceId,
            kind: 'PERSON',
            displayName:
              text(v.displayName, 'displayName', false, 300) ?? 'Новый заёмщик',
          },
        });
      if (!['PERSON', 'ENTREPRENEUR'].includes(party.kind))
        throw new BadRequestException(
          'Проверка предназначена для физического лица или ИП',
        );
      const dealId = text(v.dealId, 'dealId', false, 100);
      if (dealId) {
        const deal = await tx.deal.findFirst({
          where: { id: dealId, workspaceId, deletedAt: null },
        });
        if (!deal) throw new NotFoundException('Сделка не найдена');
        if (deal.borrowerId && deal.borrowerId !== party.legacyBorrowerId)
          throw new BadRequestException('У сделки другой заёмщик');
      }
      const assignedToId =
        text(v.assignedToId, 'assignedToId', false, 100) ?? actor;
      await this.access.assignee(tx, workspaceId, assignedToId);
      const row = await tx.borrowerVerification.create({
        data: {
          workspaceId,
          partyId: party.id,
          dealId,
          assignedToId,
          createdById: actor,
          checklistVersion: CHECKLIST_VERSION,
          riskRulesVersion: RISK_RULES_VERSION,
        },
      });
      await this.seed(tx, workspaceId, row.id);
      await this.access.audit(
        tx,
        actor,
        workspaceId,
        'VERIFICATION_CREATED',
        row.id,
      );
      return row;
    });
  }
  async list(actor: string, query: Obj) {
    const workspaceId = text(query.workspaceId, 'workspaceId', false, 100);
    if (workspaceId)
      await this.access.workspace(this.access.db, actor, workspaceId);
    const status =
      query.status === undefined
        ? undefined
        : choice<BorrowerVerificationStatus>(
            query.status,
            [
              'DRAFT',
              'IN_PROGRESS',
              'AWAITING_DOCUMENTS',
              'READY_FOR_REVIEW',
              'COMPLETED',
              'CANCELLED',
            ],
            'status',
          );
    const risk =
      query.risk === undefined
        ? undefined
        : choice<BorrowerRiskAssessment>(
            query.risk,
            ['NOT_ASSESSED', 'NOT_IDENTIFIED', 'NEEDS_REVIEW', 'IDENTIFIED'],
            'risk',
          );
    const number = page(query.page, 1, 100000),
      limit = page(query.limit, 20, 100);
    const from = timestamp(query.from, 'from'),
      to = timestamp(query.to, 'to');
    if (from && to && from > to)
      throw new BadRequestException('Некорректный период');
    const where: Prisma.BorrowerVerificationWhereInput = {
      workspaceId,
      workspace: {
        workspaceMembers: { some: { userId: actor, user: { isActive: true } } },
      },
      partyId: text(query.partyId, 'partyId', false, 100),
      assignedToId: text(query.assignedToId, 'assignedToId', false, 100),
      status,
      overallRisk: risk,
      createdAt: { gte: from, lte: to },
    };
    const [items, total] = await this.access.db.$transaction([
      this.access.db.borrowerVerification.findMany({
        where,
        include: { party: true, _count: { select: { items: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (number - 1) * limit,
        take: limit,
      }),
      this.access.db.borrowerVerification.count({ where }),
    ]);
    return { items, total, page: number, limit };
  }
  async getOne(actor: string, id: string) {
    await this.access.verification(this.access.db, actor, id);
    const row = await this.access.db.borrowerVerification.findUniqueOrThrow({
      where: { id },
      include: {
        party: true,
        identityVersion: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            acceptedRun: { include: { findings: true, risks: true } },
            runs: {
              take: 1,
              orderBy: { attemptNo: 'desc' },
              include: { findings: true, risks: true },
            },
          },
        },
        evidence: {
          orderBy: { createdAt: 'desc' },
          include: { document: true },
        },
      },
    });
    const member = await this.access.workspace(
      this.access.db,
      actor,
      row.workspaceId,
    );
    const canEdit =
      member.role !== 'VIEWER' &&
      !['COMPLETED', 'CANCELLED'].includes(row.status);
    return {
      ...row,
      memberRole: member.role,
      allowedActions: {
        edit: canEdit,
        runChecks: canEdit,
        submitReview: canEdit,
        complete:
          canEdit &&
          ['OWNER', 'ADMIN'].includes(member.role) &&
          row.status === 'READY_FOR_REVIEW',
        recheck: member.role !== 'VIEWER',
      },
      readiness: await this.readiness(actor, id),
      capabilities: this.adapters.capabilities(),
    };
  }
  async readiness(actor: string, id: string) {
    await this.access.verification(this.access.db, actor, id);
    const row = await this.access.db.borrowerVerification.findUniqueOrThrow({
      where: { id },
      include: {
        identityVersion: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    const member = await this.access.workspace(
      this.access.db,
      actor,
      row.workspaceId,
    );
    const mutable =
      member.role !== 'VIEWER' &&
      !['COMPLETED', 'CANCELLED'].includes(row.status);
    const workerEnabled = process.env.VERIFICATION_WORKER_ENABLED !== 'false';
    return {
      items: row.items.map((item) => {
        const d = definition(item.checkCode);
        const missing = d
          ? missingFields(d, row.identityVersion)
          : ['definition'];
        const available = this.adapters.supports(item.checkCode);
        return {
          itemId: item.id,
          checkCode: item.checkCode,
          missingFields: missing,
          automaticAvailable: available,
          canRunAutomatic:
            mutable && available && workerEnabled && !missing.length,
          manualAvailable: mutable,
          canRecordManual: mutable && !missing.length,
          reason:
            member.role === 'VIEWER'
              ? 'READ_ONLY'
              : !mutable
                ? 'FINALIZED'
                : !available
                  ? 'INTEGRATION_NOT_CONFIGURED'
                  : !workerEnabled
                    ? 'WORKER_DISABLED'
                    : missing.length
                      ? 'MISSING_DATA'
                      : null,
        };
      }),
    };
  }
  update(actor: string, id: string, body: unknown) {
    const v = object(body, ['assignedToId']);
    const assignedToId = text(v.assignedToId, 'assignedToId', true, 100)!;
    return this.access.write(actor, id, async (tx, row) => {
      await this.access.assignee(tx, row.workspaceId, assignedToId);
      const result = await tx.borrowerVerification.update({
        where: { id },
        data: { assignedToId },
      });
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_ASSIGNED',
        id,
        { assignedToId },
      );
      return result;
    });
  }
  async overall(tx: Tx, id: string) {
    const items = await tx.borrowerVerificationItem.findMany({
      where: { verificationId: id },
      include: { acceptedRun: true },
    });
    const runs = items
      .filter((i) => i.status === 'COMPLETED')
      .map((i) => i.acceptedRun)
      .filter((r) => r !== null);
    const risks = await tx.borrowerVerificationRisk.findMany({
      where: {
        verificationId: id,
        runId: { in: runs.map((r) => r.id) },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });
    let result: BorrowerRiskAssessment = 'NOT_IDENTIFIED';
    const assessedRisks = await tx.borrowerVerificationRisk.findMany({
      where: { verificationId: id, runId: { in: runs.map((r) => r.id) } },
    });
    if (
      risks.length ||
      runs.some(
        (r) =>
          r.riskAssessment === 'IDENTIFIED' &&
          !assessedRisks.some((k) => k.runId === r.id),
      )
    )
      result = 'IDENTIFIED';
    else if (runs.some((r) => r.riskAssessment === 'NEEDS_REVIEW'))
      result = 'NEEDS_REVIEW';
    else if (
      items.some(
        (i) =>
          i.isRequired && !['COMPLETED', 'NOT_APPLICABLE'].includes(i.status),
      )
    )
      result = 'NOT_ASSESSED';
    await tx.borrowerVerification.update({
      where: { id },
      data: { overallRisk: result },
    });
    return result;
  }
  async validateCompletion(tx: Tx, id: string) {
    const row = await tx.borrowerVerification.findUniqueOrThrow({
      where: { id },
      include: {
        items: { include: { acceptedRun: { include: { findings: true } } } },
      },
    });
    const reasons: string[] = [];
    if (!row.identityVersionId) reasons.push('IDENTITY_NOT_CONFIRMED');
    for (const item of row.items) {
      if (!item.isRequired) continue;
      if (!['COMPLETED', 'NOT_APPLICABLE'].includes(item.status)) {
        reasons.push(item.checkCode + ':INCOMPLETE');
        continue;
      }
      if (item.status === 'NOT_APPLICABLE') continue;
      const run = item.acceptedRun;
      if (
        !run ||
        run.status !== 'SUCCEEDED' ||
        run.identityVersionId !== row.identityVersionId ||
        (run.validUntil && run.validUntil <= new Date())
      )
        reasons.push(item.checkCode + ':STALE');
      if (
        run &&
        (!run.reviewedById ||
          run.findings.some((f) =>
            ['UNKNOWN', 'POSSIBLE'].includes(f.identityMatch),
          ))
      )
        reasons.push(item.checkCode + ':REVIEW_REQUIRED');
      if (
        await tx.borrowerVerificationEvidence.count({
          where: {
            verificationId: id,
            runId: run?.id ?? 'missing-run',
            OR: [
              { authenticityStatus: { in: ['DOUBTFUL', 'REJECTED'] } },
              { documentId: { not: null }, authenticityStatus: 'NOT_CHECKED' },
            ],
          },
        })
      )
        reasons.push(item.checkCode + ':DOCUMENT_REVIEW_REQUIRED');
    }
    if (
      await tx.borrowerCheckRun.count({
        where: { verificationId: id, status: { in: ['QUEUED', 'RUNNING'] } },
      })
    )
      reasons.push('CHECKS_RUNNING');
    return reasons;
  }
  submitForReview(actor: string, id: string) {
    return this.access.write(actor, id, async (tx, row) => {
      const reasons = await this.validateCompletion(tx, id);
      if (reasons.length)
        throw new ConflictException({
          message: 'Не все обязательные проверки готовы',
          reasons,
        });
      await this.overall(tx, id);
      const result = await tx.borrowerVerification.update({
        where: { id },
        data: { status: 'READY_FOR_REVIEW' },
      });
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_SUBMITTED',
        id,
      );
      return result;
    });
  }
  complete(actor: string, id: string, body: unknown) {
    const v = object(body, [
      'decision',
      'comment',
      'conditions',
      'expectedUpdatedAt',
      'validUntil',
    ]);
    const decision = choice(
      v.decision,
      ['APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED'] as const,
      'decision',
    );
    const comment = text(v.comment, 'comment')!;
    const conditions = text(
      v.conditions,
      'conditions',
      decision === 'APPROVED_WITH_CONDITIONS',
    );
    const expected = timestamp(v.expectedUpdatedAt, 'expectedUpdatedAt');
    if (!expected)
      throw new BadRequestException('Передайте expectedUpdatedAt из карточки');
    const validUntil = timestamp(v.validUntil, 'validUntil');
    if (validUntil && validUntil <= new Date())
      throw new BadRequestException('Срок актуальности уже истёк');
    return this.access.write(
      actor,
      id,
      async (tx, row) => {
        if (row.updatedAt.getTime() !== expected.getTime())
          throw new ConflictException(
            'Данные изменились. Обновите карточку перед решением',
          );
        if (row.status !== 'READY_FOR_REVIEW')
          throw new ConflictException(
            'Сначала отправьте проверку на рассмотрение',
          );
        const reasons = await this.validateCompletion(tx, id);
        if (reasons.length)
          throw new ConflictException({
            message: 'Проверка не готова',
            reasons,
          });
        const risk = await this.overall(tx, id);
        if (
          decision === 'APPROVED' &&
          ['IDENTIFIED', 'NEEDS_REVIEW', 'NOT_ASSESSED'].includes(risk)
        )
          throw new ConflictException(
            'Есть риски или неразобранные результаты',
          );
        const result = await tx.borrowerVerification.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            decision,
            decisionComment: comment,
            decisionConditions: conditions,
            decidedById: actor,
            decidedAt: new Date(),
            completedAt: new Date(),
            validUntil,
          },
        });
        await this.access.audit(
          tx,
          actor,
          row.workspaceId,
          'VERIFICATION_COMPLETED',
          id,
          { decision },
        );
        return result;
      },
      'approve',
    );
  }
  recheck(actor: string, id: string) {
    return this.access.transaction(async (tx) => {
      const old = await this.access.verification(tx, actor, id, 'write', true);
      const row = await tx.borrowerVerification.create({
        data: {
          workspaceId: old.workspaceId,
          partyId: old.partyId,
          identityVersionId: old.identityVersionId,
          dealId: old.dealId,
          previousVerificationId: old.id,
          checklistVersion: CHECKLIST_VERSION,
          riskRulesVersion: RISK_RULES_VERSION,
          createdById: actor,
          assignedToId: actor,
        },
      });
      await this.seed(tx, row.workspaceId, row.id);
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_RECHECK_CREATED',
        row.id,
        { previousVerificationId: id },
      );
      return row;
    });
  }
  cancel(actor: string, id: string) {
    return this.access.write(actor, id, async (tx, row) => {
      await tx.borrowerCheckRun.updateMany({
        where: { verificationId: id, status: { in: ['QUEUED', 'RUNNING'] } },
        data: {
          status: 'CANCELLED',
          finishedAt: new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
          riskAssessment: 'NOT_ASSESSED',
        },
      });
      const result = await tx.borrowerVerification.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_CANCELLED',
        id,
      );
      return result;
    });
  }
}
