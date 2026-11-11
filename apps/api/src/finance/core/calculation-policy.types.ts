import type { MoneyRounding } from './money.js';

import type { PaymentAllocationOrder } from './payment-allocation.types.js';

export interface FinanceCalculationPolicy {
  readonly interestRoundingMethod: 'CUMULATIVE_TOTAL';

  readonly interestRoundingMode: MoneyRounding;

  readonly paymentAllocationOrder: PaymentAllocationOrder;

  readonly eventTiming: 'BEFORE_DAILY_ACCRUAL' | 'AFTER_DAILY_ACCRUAL';

  readonly principalRepayment: 'ALLOWED' | 'BLOCKED';

  /** Остаток поступления ждёт отдельного решения. */
  readonly unappliedFunds: 'HOLD';
}
