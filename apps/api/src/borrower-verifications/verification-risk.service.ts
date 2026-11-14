import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  VerificationAccessService,
  type Tx,
} from './verification-access.service.js';
import { BorrowerVerificationsService } from './borrower-verifications.service.js';
import { assess } from './verification-results.js';
import { choice, object, text, timestamp } from './verification.validation.js';
@Injectable()
export class VerificationRiskService {
  constructor(
    private readonly access: VerificationAccessService,
    private readonly verifications: BorrowerVerificationsService,
  ) {}
  async evaluateRun(tx: Tx, runId: string, actor: string) {
    const run = await tx.borrowerCheckRun.findUniqueOrThrow({
      where: { id: runId },
      include: { item: true, findings: true },
    });
    let assessment = assess(run.item.checkCode, run, run.findings);
    if (run.item.resultType === 'DOCUMENT') {
      const evidence = await tx.borrowerVerificationEvidence.findMany({
        where: { runId, documentId: { not: null } },
      });
      assessment =
        evidence.length &&
        evidence.every((e) => e.authenticityStatus === 'CONFIRMED')
          ? 'NOT_IDENTIFIED'
          : 'NEEDS_REVIEW';
    }
    await tx.borrowerCheckRun.update({
      where: { id: runId },
      data: { riskAssessment: assessment },
    });
    const confirmed = run.findings.filter(
      (f) => f.identityMatch === 'CONFIRMED',
    );
    const expected: {
      code: string;
      findingId?: string;
      title: string;
      description: string;
    }[] = confirmed.map((f) => ({
      code: 'MATCHED_RECORD',
      findingId: f.id,
      title: f.title,
      description:
        'Найдена запись, отнесённая к заёмщику. Требуется оценка обстоятельств и влияния на сделку.',
    }));
    if (assessment === 'IDENTIFIED' && expected.length === 0)
      expected.push({
        code: 'ADVERSE_RESULT',
        title: run.item.title,
        description:
          'Результат проверки содержит признак риска по действующим правилам.',
      });
    const existing = await tx.borrowerVerificationRisk.findMany({
      where: { runId },
    });
    for (const risk of existing.filter(
      (r) =>
        ['OPEN', 'IN_PROGRESS'].includes(r.status) &&
        ['MATCHED_RECORD', 'ADVERSE_RESULT'].includes(r.riskCode),
    )) {
      if (
        !expected.some(
          (e) =>
            e.code === risk.riskCode &&
            (e.findingId ?? null) === risk.findingId,
        )
      )
        await tx.borrowerVerificationRisk.update({
          where: { id: risk.id },
          data: {
            status: 'DISMISSED',
            resolutionComment:
              'Уточнена принадлежность или оценка найденной записи',
            resolvedById: actor,
            resolvedAt: new Date(),
          },
        });
    }
    for (const e of expected) {
      const prior = existing.find(
        (r) =>
          r.riskCode === e.code &&
          (r.findingId ?? null) === (e.findingId ?? null),
      );
      if (
        prior?.status === 'DISMISSED' &&
        prior.resolutionComment ===
          'Уточнена принадлежность или оценка найденной записи'
      )
        await tx.borrowerVerificationRisk.update({
          where: { id: prior.id },
          data: {
            status: 'OPEN',
            resolvedById: null,
            resolvedAt: null,
            resolutionComment: null,
            resolutionEvidenceId: null,
          },
        });
      if (!prior)
        await tx.borrowerVerificationRisk.create({
          data: {
            workspaceId: run.workspaceId,
            verificationId: run.verificationId,
            itemId: run.itemId,
            runId,
            riskCode: e.code,
            ruleVersion: run.assessmentRulesVersion,
            title: e.title,
            description: e.description,
            findingId: e.findingId,
            severity: ['PASSPORT_VALIDITY', 'CAPACITY', 'ROSFIN'].includes(
              run.item.checkCode,
            )
              ? 'HIGH'
              : 'MEDIUM',
          },
        });
    }
    await this.verifications.overall(tx, run.verificationId);
    return assessment;
  }
  async list(actor: string, id: string, query: Record<string, unknown> = {}) {
    await this.access.verification(this.access.db, actor, id);
    const status =
      query.status === undefined
        ? undefined
        : choice(
            query.status,
            ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'] as const,
            'status',
          );
    const severity =
      query.severity === undefined
        ? undefined
        : choice(
            query.severity,
            ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const,
            'severity',
          );
    return this.access.db.borrowerVerificationRisk.findMany({
      where: { verificationId: id, status, severity },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
  }
  create(actor: string, id: string, body: unknown) {
    const v = object(body, [
      'itemId',
      'runId',
      'findingId',
      'riskCode',
      'title',
      'description',
      'severity',
      'remediability',
      'requiredAction',
    ]);
    return this.access.write(actor, id, async (tx, row) => {
      const itemId = text(v.itemId, 'itemId', true, 100)!,
        runId = text(v.runId, 'runId', true, 100)!,
        findingId = text(v.findingId, 'findingId', false, 100);
      await this.access.item(tx, id, itemId);
      if (
        !(await tx.borrowerCheckRun.findFirst({
          where: { id: runId, itemId, verificationId: id, status: 'SUCCEEDED' },
        }))
      )
        throw new BadRequestException(
          'Риск должен относиться к успешному запуску этого пункта',
        );
      if (
        findingId &&
        !(await tx.borrowerCheckFinding.findFirst({
          where: { id: findingId, runId },
        }))
      )
        throw new NotFoundException('Найденная запись не найдена');
      const riskCode = 'MANUAL:' + text(v.riskCode, 'riskCode', true, 80)!;
      const result = await tx.borrowerVerificationRisk.create({
        data: {
          workspaceId: row.workspaceId,
          verificationId: id,
          itemId,
          runId,
          findingId,
          riskCode,
          ruleVersion: row.riskRulesVersion,
          title: text(v.title, 'title', true, 500)!,
          description: text(v.description, 'description')!,
          severity: choice(
            v.severity,
            ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const,
            'severity',
          ),
          remediability:
            v.remediability === undefined
              ? 'UNKNOWN'
              : choice(
                  v.remediability,
                  ['REMEDIABLE', 'NON_REMEDIABLE', 'UNKNOWN'] as const,
                  'remediability',
                ),
          requiredAction: text(v.requiredAction, 'requiredAction', false),
        },
      });
      await this.verifications.overall(tx, id);
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_RISK_CREATED',
        id,
        { riskId: result.id },
      );
      return result;
    });
  }
  change(
    actor: string,
    id: string,
    riskId: string,
    action: 'update' | 'start' | 'resolve' | 'dismiss',
    body: unknown,
  ) {
    const v = object(
      body,
      action === 'update'
        ? ['assignedToId', 'dueAt', 'requiredAction']
        : action === 'start'
          ? []
          : ['comment', 'evidenceId'],
    );
    return this.access.write(actor, id, async (tx, row) => {
      const risk = await tx.borrowerVerificationRisk.findFirst({
        where: { id: riskId, verificationId: id },
      });
      if (!risk) throw new NotFoundException('Риск не найден');
      if (['RESOLVED', 'DISMISSED'].includes(risk.status))
        throw new ConflictException('Риск уже закрыт');
      let data: Prisma.BorrowerVerificationRiskUncheckedUpdateInput = {};
      if (action === 'update') {
        const assignedToId = text(v.assignedToId, 'assignedToId', false, 100);
        if (assignedToId)
          await this.access.assignee(tx, row.workspaceId, assignedToId);
        data = {
          assignedToId,
          dueAt: timestamp(v.dueAt, 'dueAt'),
          requiredAction: text(v.requiredAction, 'requiredAction', false),
        };
      } else if (action === 'start') data = { status: 'IN_PROGRESS' };
      else {
        const evidenceId = text(
          v.evidenceId,
          'evidenceId',
          action === 'resolve',
          100,
        );
        if (
          evidenceId &&
          !(await tx.borrowerVerificationEvidence.findFirst({
            where: {
              id: evidenceId,
              verificationId: id,
              authenticityStatus: 'CONFIRMED',
            },
          }))
        )
          throw new BadRequestException(
            'Нужно подтверждённое доказательство из этой проверки',
          );
        data = {
          status: action === 'resolve' ? 'RESOLVED' : 'DISMISSED',
          resolutionComment: text(v.comment, 'comment')!,
          resolutionEvidenceId: evidenceId,
          resolvedById: actor,
          resolvedAt: new Date(),
        };
      }
      const result = await tx.borrowerVerificationRisk.update({
        where: { id: riskId },
        data,
      });
      await this.verifications.overall(tx, id);
      await this.access.audit(
        tx,
        actor,
        row.workspaceId,
        'VERIFICATION_RISK_' + action.toUpperCase(),
        id,
        { riskId },
      );
      return result;
    });
  }
}
