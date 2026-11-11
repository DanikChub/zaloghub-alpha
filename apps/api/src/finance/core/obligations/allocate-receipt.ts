import type {
  AllocateReceiptInput,
  ReceiptAllocationResult,
} from './receipt-allocation.types.js';

import type { ObligationAllocation } from './obligation.types.js';

import { decimal } from '../money.js';
import { validateEvents } from '../validate-events.js';

import { readObligations } from './read-obligations.js';

import { validateObligationLedger } from './validate-obligation-ledger.js';

import { selectReceiptTargets } from './receipt-allocation-policy.js';

export function allocateReceipt(
  input: AllocateReceiptInput,
): ReceiptAllocationResult {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Некорректный вход распределения');
  }

  const { receipt, obligations, previousAllocations, policy } = input;

  validateEvents([receipt]);

  if (receipt.kind !== 'RECEIPT') {
    throw new Error('Распределять можно только поступление');
  }

  const snapshot = readObligations(
    obligations,
    previousAllocations,
    receipt.effectiveOn,
  );

  if (previousAllocations.some((row) => row.paymentId === receipt.id)) {
    throw new Error('Поступление уже распределено');
  }

  if (
    previousAllocations.some((row) => row.effectiveOn > receipt.effectiveOn)
  ) {
    throw new Error('Для платежа задним числом нужен полный пересчёт');
  }

  const targets = selectReceiptTargets(snapshot, policy);

  let remaining = decimal(receipt.amount);

  const allocations: ObligationAllocation[] = [];

  for (const target of targets) {
    if (remaining.isZero()) {
      break;
    }

    const balance = decimal(target.remainingAmount);

    const portion = remaining.lessThan(balance) ? remaining : balance;

    const orderNo = allocations.length + 1;

    allocations.push({
      id: `${receipt.id}:allocation:${orderNo}`,

      paymentId: receipt.id,
      obligationKey: target.key,

      effectiveOn: receipt.effectiveOn,
      orderNo,

      amount: portion.toFixed(2),
    });

    remaining = remaining.minus(portion);
  }

  validateObligationLedger(obligations, [
    ...previousAllocations,
    ...allocations,
  ]);

  return {
    paymentId: receipt.id,
    effectiveOn: receipt.effectiveOn,

    amount: decimal(receipt.amount).toFixed(2),

    allocatedAmount: decimal(receipt.amount).minus(remaining).toFixed(2),

    unallocatedAmount: remaining.toFixed(2),

    allocations,
  };
}
