import type { Decimal } from 'decimal.js';

import type { Money } from './finance.types.js';
import type { MoneyRounding } from './money.js';

export interface InterestLedger {
  /** Начисления с сохранёнными дробными копейками. */
  readonly accruedRaw: Decimal;

  /** Уже погашенные проценты, с точностью до копеек. */
  readonly paid: Decimal;

  readonly roundingMethod: 'CUMULATIVE_TOTAL';
  readonly roundingMode: MoneyRounding;
}

export interface InterestLedgerSnapshot {
  /** Округлённый накопленный итог начислений. */
  readonly accruedTotal: Money;

  /** Сумма оплаченных процентов. */
  readonly paidTotal: Money;

  /** Осталось оплатить процентов. */
  readonly outstanding: Money;
}
