import type {
  LocalDate,
  Money,
  ReceiptEvent,
} from '../finance.types.js';

import type {
  ObligationAllocation,
  ObligationComponent,
  ObligationSnapshot,
  PaymentObligation,
} from './obligation.types.js';

export interface ReceiptAllocationPolicy {
  readonly priority: 'DUE_FIRST';

  readonly componentOrder: readonly ObligationComponent[];

  readonly earlyInterest: 'CURRENT_PERIOD' | 'NONE';

  readonly earlyPrincipal: 'ALLOWED' | 'BLOCKED';

  readonly unappliedFunds: 'HOLD';
}

export interface AllocateReceiptInput {
  readonly receipt: ReceiptEvent;

  readonly obligations: readonly PaymentObligation[];

  readonly previousAllocations: readonly ObligationAllocation[];

  readonly policy: ReceiptAllocationPolicy;
}

export interface ReceiptAllocationResult {
  readonly paymentId: string;
  readonly effectiveOn: LocalDate;

  readonly amount: Money;
  readonly allocatedAmount: Money;
  readonly unallocatedAmount: Money;

  /** Только новые строки этого поступления. */
  readonly allocations: readonly ObligationAllocation[];
}

export interface ReplayReceiptsInput {
  readonly obligations: readonly PaymentObligation[];

  readonly receipts: readonly ReceiptEvent[];

  readonly asOfOn: LocalDate;

  readonly policy: ReceiptAllocationPolicy;
}

export interface ReceiptReplayResult {
  readonly payments: readonly ReceiptAllocationResult[];

  readonly allocations: readonly ObligationAllocation[];

  readonly receivedTotal: Money;
  readonly unappliedCredit: Money;

  readonly snapshot: ObligationSnapshot;
}