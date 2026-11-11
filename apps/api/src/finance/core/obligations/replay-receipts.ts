import type {
  ReplayReceiptsInput,
  ReceiptReplayResult,
  ReceiptAllocationResult,
} from './receipt-allocation.types.js';

import type { ObligationAllocation } from './obligation.types.js';

import { decimal } from '../money.js';
import { prepareEvents } from '../prepare-events.js';

import { allocateReceipt } from './allocate-receipt.js';
import { readObligations } from './read-obligations.js';

import { validateReceiptAllocationPolicy } from './receipt-allocation-policy.js';

export function replayReceipts(
  input: ReplayReceiptsInput,
): ReceiptReplayResult {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Некорректный вход пересчёта поступлений');
  }

  validateReceiptAllocationPolicy(input.policy);

  const ordered = prepareEvents(input.receipts, input.asOfOn);

  if (input.receipts.some((event) => event.kind !== 'RECEIPT')) {
    throw new Error('История должна содержать только поступления');
  }

  const allocations: ObligationAllocation[] = [];
  const payments: ReceiptAllocationResult[] = [];

  let receivedTotal = decimal('0');
  let unappliedCredit = decimal('0');

  for (const receipt of ordered) {
    if (receipt.kind !== 'RECEIPT') {
      throw new Error('История должна содержать только поступления');
    }

    const result = allocateReceipt({
      receipt,
      obligations: input.obligations,
      previousAllocations: allocations,
      policy: input.policy,
    });

    allocations.push(...result.allocations);
    payments.push(result);

    receivedTotal = receivedTotal.plus(receipt.amount);

    unappliedCredit = unappliedCredit.plus(result.unallocatedAmount);
  }

  return {
    payments,
    allocations,

    receivedTotal: receivedTotal.toFixed(2),
    unappliedCredit: unappliedCredit.toFixed(2),

    snapshot: readObligations(input.obligations, allocations, input.asOfOn),
  };
}

