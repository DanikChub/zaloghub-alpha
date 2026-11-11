import type { FinancialEvent, LocalDate } from './finance.types.js';

import type { MonthlyInterestTerms } from './interest.types.js';

import type { FinanceCalculationPolicy } from './calculation-policy.types.js';

import type { FixedDailyPenaltyTerms } from './penalty.types.js';

export interface FinanceCalculationInput {
  readonly loanId: string;

  readonly currency: string;

  /** Состояние на конец указанного дня. */
  readonly asOfOn: LocalDate;

  readonly interest: MonthlyInterestTerms;

  readonly policy: FinanceCalculationPolicy;

  readonly events: readonly FinancialEvent[];

  readonly penalty?: FixedDailyPenaltyTerms;
}
