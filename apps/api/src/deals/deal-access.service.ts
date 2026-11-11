import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { dealInclude } from './deal-query.js';
import {
  calculateDealFinance,
  financeToday,
} from '../finance/infrastructure/deal-finance.mapper.js';
import { persistFinanceJournal } from '../finance/infrastructure/persist-finance-journal.js';

interface DealLockOptions {
  persistJournal?: boolean;
  asOfOn?: string;
}

@Injectable()
export class DealAccessService {
  private readonly logger = new Logger(DealAccessService.name);

  constructor(private readonly prisma: PrismaService) {}

  async one(userId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, userId, deletedAt: null },
      include: dealInclude,
    });

    if (!deal) {
      throw new NotFoundException('Сделка не найдена');
    }

    return deal;
  }

  async withDealLock<T extends object>(
    userId: string,
    id: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
    options: DealLockOptions = {},
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id
          FROM deals
          WHERE id = ${id}
            AND "userId" = ${userId}
            AND "deletedAt" IS NULL
          FOR UPDATE
        `);

        if (!rows.length) {
          throw new NotFoundException('Сделка не найдена');
        }

        // Одна дата для всей операции, даже на границе полуночи.
        const asOfOn = options.asOfOn ?? financeToday();
        const shouldPersist = options.persistJournal !== false;

        if (shouldPersist) {
          const before = await tx.deal.findUniqueOrThrow({
            where: { id },
            include: dealInclude,
          });

          let beforeFinance:
            ReturnType<typeof calculateDealFinance> | undefined;

          try {
            beforeFinance = calculateDealFinance(before, asOfOn);
          } catch (error) {
            // Некорректное старое состояние не должно запрещать
            // исправление условий или отмену ошибочной операции.
            if (!(error instanceof BadRequestException)) {
              throw error;
            }

            this.logger.warn(
              `Не сохранено состояние до изменения сделки ${id}: ` +
                error.message,
            );
          }

          if (beforeFinance?.status === 'READY') {
            await persistFinanceJournal(tx, before, beforeFinance);
          }
        }

        const result = await action(tx);

        const deal = await tx.deal.findUniqueOrThrow({
          where: { id },
          include: dealInclude,
        });

        const finance = calculateDealFinance(deal, asOfOn);

        if (shouldPersist && finance.status === 'READY') {
          await persistFinanceJournal(tx, deal, finance);
        }

        return {
          ...result,
          finance,
        };
      },
      { timeout: 30000 },
    );
  }
}
