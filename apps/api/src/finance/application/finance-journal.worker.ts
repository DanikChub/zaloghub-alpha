import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { financeToday } from '../infrastructure/deal-finance.mapper.js';
import { DealFinanceJournalService } from './deal-finance-journal.service.js';

@Injectable()
export class FinanceJournalWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(FinanceJournalWorker.name);

  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: DealFinanceJournalService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.FINANCE_JOURNAL_WORKER_ENABLED !== 'true') {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);

    this.timer.unref();

    void this.tick();
  }

  onApplicationShutdown() {
    this.stopping = true;

    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async tick() {
    if (this.running || this.stopping) {
      return;
    }

    this.running = true;

    try {
      const asOfOn = financeToday();
      const date = new Date(`${asOfOn}T00:00:00.000Z`);
      let afterId: string | undefined;

      while (!this.stopping) {
        const deals = await this.prisma.deal.findMany({
          where: {
            deletedAt: null,
            financeTerms: {
              not: Prisma.DbNull,
            },
            ...(afterId ? { id: { gt: afterId } } : {}),
            financeJournalVersions: {
              none: {
                asOfOn: date,
              },
            },
          },
          select: {
            id: true,
            userId: true,
          },
          orderBy: {
            id: 'asc',
          },
          take: 50,
        });

        if (deals.length === 0) {
          break;
        }

        for (const deal of deals) {
          if (this.stopping || financeToday() !== asOfOn) {
            return;
          }

          try {
            await this.journal.save(deal.userId, deal.id, asOfOn);
          } catch (error) {
            // Ошибка одной сделки не останавливает остальные.
            // На следующем проходе будет повторная попытка.
            this.logger.error(
              `Не удалось сохранить журнал сделки ${deal.id} ` + `на ${asOfOn}`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        }

        afterId = deals[deals.length - 1]!.id;
      }
    } catch (error) {
      this.logger.error(
        'Ошибка фонового сохранения журналов',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
