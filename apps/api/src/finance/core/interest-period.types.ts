import type { LocalDate, Money } from './finance.types.js';

import type { MonthlyInterestTerms } from './interest.types.js';

export interface InterestPeriodInput {
  /** Остаток основного долга на протяжении всего периода. */
  readonly principal: Money;

  /** Первый день начисления включительно. */
  readonly fromOn: LocalDate;

  /** Правая граница периода, не включается в начисление. */
  readonly toOnExclusive: LocalDate;

  readonly terms: MonthlyInterestTerms;
}
