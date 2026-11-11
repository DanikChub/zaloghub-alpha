import type { LocalDate, Money } from '../finance.types.js';
interface ActionBase {
  readonly id: string;
  readonly effectiveOn: LocalDate;
  readonly sequenceNo: number;
}
export type LoanAction =
  | (ActionBase & {
      readonly kind: 'REFUND_REQUEST';
      readonly receiptId: string;
      readonly amount: Money;
    })
  | (ActionBase & {
      readonly kind: 'REFUND' | 'CANCEL_REFUND' | 'CANCEL_CREDIT';
      readonly instructionId: string;
    })
  | (ActionBase & {
      readonly kind: 'CREDIT';
      readonly receiptId: string;
      readonly targets: readonly { obligationKey: string; amount: Money }[];
    })
  | (ActionBase & { readonly kind: 'SETTLEMENT' });

export interface ReceiptCredit {
  readonly receiptId: string;
  readonly refundedAmount: Money;
  readonly remainingAmount: Money;
  readonly reservedForRefund: Money;
  readonly reservedForFuture: Money;
  readonly availableAmount: Money;
}
