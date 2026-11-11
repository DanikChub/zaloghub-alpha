import type { Decimal } from 'decimal.js';

import type { InterestLedger } from './interest-ledger.types.js';
import type { MoneyRounding } from './money.js';

import { decimal } from './money.js';

export function createInterestLedger(
  roundingMode: MoneyRounding,
): InterestLedger {
  if (
    roundingMode !== 'HALF_UP' &&
    roundingMode !== 'HALF_EVEN' &&
    roundingMode !== 'DOWN'
  ) {
    throw new Error('Неподдерживаемый способ округления');
  }

  return {
    accruedRaw: decimal('0'),
    paid: decimal('0'),
    roundingMethod: 'CUMULATIVE_TOTAL',
    roundingMode,
  };
}

export function accrueInterest(
  ledger: InterestLedger,
  amount: Decimal,
): InterestLedger {
  if (!amount.isFinite() || amount.isNegative()) {
    throw new Error('Начисление должно быть конечной неотрицательной суммой');
  }

  return {
    ...ledger,
    accruedRaw: ledger.accruedRaw.plus(amount),
  };
}
