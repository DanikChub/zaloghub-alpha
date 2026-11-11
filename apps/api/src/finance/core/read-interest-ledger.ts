import type {
  InterestLedger,
  InterestLedgerSnapshot,
} from './interest-ledger.types.js';

import { decimal, formatMoney } from './money.js';

export function readInterestLedger(
  ledger: InterestLedger,
): InterestLedgerSnapshot {
  const accruedTotal = formatMoney(ledger.accruedRaw, ledger.roundingMode);

  const outstanding = decimal(accruedTotal).minus(ledger.paid);

  if (outstanding.isNegative()) {
    throw new Error('Оплаченные проценты превышают округлённые начисления');
  }

  return {
    accruedTotal,
    paidTotal: ledger.paid.toFixed(2),
    outstanding: outstanding.toFixed(2),
  };
}
