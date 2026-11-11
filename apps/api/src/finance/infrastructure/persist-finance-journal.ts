import type { Prisma } from '../../generated/prisma/client.js';
import { contentHash } from '../calendar/russian-calendar.js';
import {
  toLoanInput,
  type FinanceDeal,
  type calculateDealFinance,
} from './deal-finance.mapper.js';

type ReadyFinance = Extract<
  ReturnType<typeof calculateDealFinance>,
  { status: 'READY' }
>;

/**
 * Вызывается только внутри транзакции с блокировкой сделки.
 * Существующие версии не изменяются.
 */
export async function persistFinanceJournal(
  tx: Prisma.TransactionClient,
  deal: FinanceDeal,
  result: ReadyFinance,
) {
  const input = toLoanInput(deal, result.asOfOn);

  const payload = JSON.parse(
    JSON.stringify({
      schemaVersion: 1,
      input: {
        ...input,
        events: input.events.filter(
          (event) => event.effectiveOn <= result.asOfOn,
        ),
        actions: (input.actions ?? []).filter(
          (action) => action.effectiveOn <= result.asOfOn,
        ),
      },
      result,
    }),
  ) as Prisma.InputJsonObject;

  const hash = contentHash(payload);

  const latest = await tx.dealFinanceJournalVersion.findFirst({
    where: { dealId: deal.id },
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
  });

  if (latest?.contentHash === hash) {
    return {
      version: latest,
      created: false,
    };
  }

  // До и после изменения могут сохраняться в одну миллисекунду.
  // Обеспечиваем однозначный порядок версий внутри сделки.
  const recordedAt = new Date(
    Math.max(Date.now(), latest ? latest.recordedAt.getTime() + 1 : 0),
  );

  const version = await tx.dealFinanceJournalVersion.create({
    data: {
      dealId: deal.id,
      asOfOn: new Date(`${result.asOfOn}T00:00:00.000Z`),
      recordedAt,
      engineVersion: result.engineVersion,
      schemaVersion: 1,
      contentHash: hash,
      payload,
    },
  });

  return {
    version,
    created: true,
  };
}
