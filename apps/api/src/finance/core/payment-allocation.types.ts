import type { Money } from './finance.types.js';

export type PaymentAllocationOrder =
  'INTEREST_THEN_PRINCIPAL' | 'PRINCIPAL_THEN_INTEREST';

export interface PaymentAllocationInput {
  /** Распределяемое поступление. */
  readonly amount: Money;

  /** Основной долг, который разрешено погасить. */
  readonly principalToPay: Money;

  /** Проценты, которые разрешено погасить. */
  readonly interestToPay: Money;

  readonly order: PaymentAllocationOrder;
}

export interface PaymentAllocationResult {
  /** Направлено на основной долг. */
  readonly principalPaid: Money;

  /** Направлено на проценты. */
  readonly interestPaid: Money;

  /** Нераспределённая часть поступления. */
  readonly unallocatedAmount: Money;

  /** Остаток переданной суммы основного долга. */
  readonly principalRemaining: Money;

  /** Остаток переданной суммы процентов. */
  readonly interestRemaining: Money;
}
