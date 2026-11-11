import type { LocalDate, Money } from '../finance.types.js';

import type { MonthlyInterestTerms } from '../interest.types.js';

import type { MoneyRounding } from '../money.js';

import type { InterestSchedulePeriod } from '../schedule/schedule.types.js';

export type ObligationComponent =
  'PRINCIPAL' | 'INTEREST' | 'PENALTY' | 'EXPENSE';

export interface PaymentObligation {
  readonly key: string;
  readonly component: ObligationComponent;

  readonly dueOn: LocalDate;

  /**
   * Сумма к сроку оплаты.
   * Для будущего периода это план, который может пересчитываться.
   */
  readonly amount: Money;

  readonly periodFromOn: LocalDate | null;
  readonly periodToOnExclusive: LocalDate | null;
}

/** Часть поступления, направленная на конкретное обязательство. */
export interface ObligationAllocation {
  readonly id: string;
  readonly paymentId: string;
  readonly obligationKey: string;

  /** Дата применения этой части поступления. */
  readonly effectiveOn: LocalDate;

  /** Порядок частей в рамках одного поступления. */
  readonly orderNo: number;

  readonly amount: Money;
}

export type ObligationStatus = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE' | 'SETTLED';

export interface ObligationState extends PaymentObligation {
  readonly paidAmount: Money;
  readonly remainingAmount: Money;

  readonly status: ObligationStatus;
  readonly daysPastDue: number;
}

export interface ObligationSnapshot {
  readonly asOfOn: LocalDate;

  readonly obligations: readonly ObligationState[];

  /** Остатки обязательств со сроком сегодня или раньше. */
  readonly dueNow: Money;

  /** Просроченная часть dueNow. */
  readonly overdueTotal: Money;

  /** Максимальная текущая просрочка среди открытых обязательств. */
  readonly daysPastDue: number;

  /** Ближайшая будущая дата с непогашенной плановой суммой. */
  readonly nextPaymentOn: LocalDate | null;
  readonly nextPaymentAmount: Money | null;
}

/** План при постоянном основном долге и одной ставке. */
export interface FixedInterestPlanInput {
  readonly periods: readonly InterestSchedulePeriod[];

  readonly principal: Money;
  readonly terms: MonthlyInterestTerms;
  readonly roundingMode: MoneyRounding;
}
