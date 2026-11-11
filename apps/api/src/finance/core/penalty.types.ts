import type { LocalDate, Money } from './finance.types.js';

import type { InterestRate } from './interest.types.js';
import type { MoneyRounding } from './money.js';

export interface FixedDailyPenaltyTerms {
  readonly kind: 'FIXED_DAILY';

  /** Фиксированная база начисления на весь период. */
  readonly baseAmount: Money;

  /** Дневная ставка: "0.015" означает 1,5% в день. */
  readonly dailyRate: InterestRate;

  /** Первый день начисления включительно. */
  readonly fromOn: LocalDate;

  /**
   * Исключённая правая граница.
   * null — начислять до даты расчёта включительно.
   */
  readonly toOnExclusive: LocalDate | null;

  /** Округление итоговой суммы за весь период. */
  readonly roundingMode: MoneyRounding;
}
