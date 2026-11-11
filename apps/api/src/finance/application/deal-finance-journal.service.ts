import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { DealAccessService } from '../../deals/deal-access.service.js';
import { dealInclude } from '../../deals/deal-query.js';
import {
  calculateDealFinance,
  financeToday,
} from '../infrastructure/deal-finance.mapper.js';
import { persistFinanceJournal } from '../infrastructure/persist-finance-journal.js';
import { validateLocalDate } from '../core/dates.js';

@Injectable()
export class DealFinanceJournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: DealAccessService,
  ) {}

  async save(userId: string, dealId: string, requestedOn?: string) {
    const asOfOn = requestedOn ?? financeToday();

    try {
      validateLocalDate(asOfOn);
    } catch {
      throw new BadRequestException('Неверная календарная дата');
    }

    if (asOfOn > financeToday()) {
      throw new BadRequestException(
        'Журнал фактических начислений нельзя сохранить на будущую дату',
      );
    }

    return this.access.withDealLock(
      userId,
      dealId,
      async (tx) => {
        const deal = await tx.deal.findUniqueOrThrow({
          where: { id: dealId },
          include: dealInclude,
        });

        const finance = calculateDealFinance(deal, asOfOn);

        if (finance.status !== 'READY') {
          throw new BadRequestException(
            'Сначала подтвердите финансовые условия договора',
          );
        }

        return persistFinanceJournal(tx, deal, finance);
      },
      {
        persistJournal: false,
        asOfOn,
      },
    );
  }

  async list(userId: string, dealId: string) {
    await this.access.one(userId, dealId);

    // В списке не передаём тяжёлую ежедневную детализацию.
    return this.prisma.dealFinanceJournalVersion.findMany({
      where: { dealId },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        dealId: true,
        asOfOn: true,
        recordedAt: true,
        engineVersion: true,
        schemaVersion: true,
        contentHash: true,
      },
    });
  }

  async one(userId: string, dealId: string, versionId: string) {
    await this.access.one(userId, dealId);

    const version = await this.prisma.dealFinanceJournalVersion.findFirst({
      where: {
        id: versionId,
        dealId,
      },
    });

    if (!version) {
      throw new NotFoundException('Версия журнала не найдена');
    }

    return version;
  }
}