import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DealAccessService } from '../../deals/deal-access.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { LoanTerms } from '../core/loan/loan.types.js';
import { RussianCalendarService } from '../calendar/russian-calendar.service.js';
import { contentHash } from '../calendar/russian-calendar.js';
import { describeFinanceTerms } from './finance-terms-description.js';
import { validateLoan } from '../core/loan/validate-loan.js';
import { validateLocalDate } from '../core/dates.js';
import {
  financeToday,
  calculateDealFinance,
} from '../infrastructure/deal-finance.mapper.js';
import { suggestDealTerms } from '../infrastructure/deal-finance.mapper.js';
@Injectable()
export class FinanceTermsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: DealAccessService,
    private readonly calendars: RussianCalendarService,
  ) {}
  async financeTerms(userId: string, id: string) {
    const deal = await this.access.one(userId, id);
    const history = await this.prisma.auditEntry.findMany({
      where: {
        entityType: 'Deal',
        entityId: id,
        action: 'DEAL_FINANCE_TERMS_REPLACED',
      },
      orderBy: { recordedAt: 'desc' },
      select: { id: true, recordedAt: true, details: true },
    });
    return {
      terms: deal.financeTerms,
      description: deal.financeTerms
        ? describeFinanceTerms(deal.financeTerms as unknown as LoanTerms)
        : [],
      suggestedTerms: suggestDealTerms(deal),
      history,
      requiresConfirmation: deal.financeTerms === null,
      notes: [
        'Перед сохранением запросите preview: сервер вернёт описание и confirmationHash.',
        'Календарь РФ загружается сервером и фиксируется версиями.',
        'Переплата не расходуется автоматически; закрытие во время моратория требует отдельного соглашения.',
      ],
    };
  }

  async preview(userId: string, id: string, input: LoanTerms) {
    const deal = await this.access.one(userId, id);
    const terms = await this.prepare(input);
    const finance = calculateDealFinance({ ...deal, financeTerms: terms });
    return {
      terms,
      description: describeFinanceTerms(terms),
      confirmationHash: contentHash(terms),
      finance,
    };
  }

  private async prepare(input: LoanTerms): Promise<LoanTerms> {
    try {
      validateLoan({
        loanId: 'terms-preview',
        currency: 'RUB',
        asOfOn: financeToday(),
        terms: { ...input, rateLoss: undefined },
        events: [],
      });
      const terms = structuredClone(input);
      if (terms.rateLoss) {
        const requestedEnd = terms.rateLoss.calendar?.toOn ?? financeToday();
        validateLocalDate(requestedEnd);
        const toOn = [
          financeToday(),
          requestedEnd,
          terms.schedule.accrualStartOn,
        ]
          .sort()
          .at(-1)!;
        const coverage = await this.calendars.coverage(
          terms.schedule.accrualStartOn,
          toOn,
          terms.calendarVersionIds,
        );
        return {
          ...terms,
          calendarVersionIds: coverage.versions.map((v) => v.id).sort(),
          rateLoss: { ...terms.rateLoss, calendar: coverage.calendar },
        };
      }
      return terms;
    } catch (error) {
      if (error instanceof Error && 'getStatus' in error) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Неверные условия',
      );
    }
  }

  async extendCalendar(userId: string, id: string, throughOn = financeToday()) {
    const deal = await this.access.one(userId, id);
    if (!deal.financeTerms)
      throw new BadRequestException('Финансовые условия не настроены');
    const terms = deal.financeTerms as unknown as LoanTerms;
    if (!terms.rateLoss)
      throw new BadRequestException('Правило рабочих дней не включено');
    try {
      validateLocalDate(throughOn);
    } catch {
      throw new BadRequestException('Неверная дата покрытия календаря');
    }
    const toOn = [throughOn, financeToday(), terms.rateLoss.calendar.toOn]
      .sort()
      .at(-1)!;
    const existing = await this.prisma.calendarVersion.findMany({
      where: { id: { in: [...(terms.calendarVersionIds ?? [])] } },
    });
    const ids: string[] = [];
    for (
      let year = Number(terms.schedule.accrualStartOn.slice(0, 4));
      year <= Number(toOn.slice(0, 4));
      year++
    ) {
      const pinned = existing.find((v) => v.year === year);
      ids.push(pinned?.id ?? (await this.calendars.importYear(year)).id);
    }
    return this.setFinanceTerms(userId, id, {
      ...terms,
      calendarVersionIds: ids,
      rateLoss: {
        ...terms.rateLoss,
        calendar: { ...terms.rateLoss.calendar, toOn },
      },
    });
  }

  async setFinanceTerms(
    userId: string,
    id: string,
    input: LoanTerms,
    confirmationHash?: string,
  ) {
    const terms = await this.prepare(input);
    if (
      confirmationHash !== undefined &&
      confirmationHash !== contentHash(terms)
    )
      throw new BadRequestException(
        'Условия изменились после предварительного просмотра',
      );
    return this.access.withDealLock(userId, id, async (tx) => {
      const previous = await tx.deal.findUniqueOrThrow({ where: { id } });
      const updated = await tx.deal.update({
        where: { id },
        data: { financeTerms: terms as unknown as Prisma.InputJsonObject },
      });
      if (updated.workspaceId)
        await tx.auditEntry.create({
          data: {
            workspaceId: updated.workspaceId,
            actorId: userId,
            action: 'DEAL_FINANCE_TERMS_REPLACED',
            entityType: 'Deal',
            entityId: id,
            details: {
              before: previous.financeTerms,
              after: terms,
            } as unknown as Prisma.InputJsonObject,
          },
        });
      return updated;
    });
  }
}
