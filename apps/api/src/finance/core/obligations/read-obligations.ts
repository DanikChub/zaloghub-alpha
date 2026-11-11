import type { LocalDate, Money } from '../finance.types.js';

import type {
  ObligationAllocation,
  ObligationSnapshot,
  ObligationState,
  ObligationStatus,
  PaymentObligation,
} from './obligation.types.js';

import { daysBetween, validateLocalDate } from '../dates.js';

import { decimal } from '../money.js';

import { validateObligationLedger } from './validate-obligation-ledger.js';

export function readObligations(
  obligations: readonly PaymentObligation[],
  allocations: readonly ObligationAllocation[],
  asOfOn: LocalDate,
): ObligationSnapshot {
  validateLocalDate(asOfOn);
  validateObligationLedger(obligations, allocations);

  const paidByKey = new Map<string, Money>();

  for (const allocation of allocations) {
    if (allocation.effectiveOn > asOfOn) {
      continue;
    }

    const paid = decimal(
      paidByKey.get(allocation.obligationKey) ?? '0.00',
    ).plus(allocation.amount);

    paidByKey.set(allocation.obligationKey, paid.toFixed(2));
  }

  const states: ObligationState[] = obligations.map((obligation) => {
    const paid = decimal(paidByKey.get(obligation.key) ?? '0.00');

    const remaining = decimal(obligation.amount).minus(paid);

    if (remaining.isNegative()) {
      throw new Error(
        `Распределение превышает сумму обязательства: ${obligation.key}`,
      );
    }

    let status: ObligationStatus;

    if (remaining.isZero()) {
      status = 'SETTLED';
    } else if (obligation.dueOn < asOfOn) {
      status = 'OVERDUE';
    } else if (obligation.dueOn === asOfOn) {
      status = 'DUE_TODAY';
    } else {
      status = 'UPCOMING';
    }

    return {
      ...obligation,

      paidAmount: paid.toFixed(2),
      remainingAmount: remaining.toFixed(2),

      status,

      daysPastDue:
        status === 'OVERDUE' ? daysBetween(obligation.dueOn, asOfOn) : 0,
    };
  });

  states.sort((left, right) => {
    if (left.dueOn !== right.dueOn) {
      return left.dueOn < right.dueOn ? -1 : 1;
    }

    if (left.key === right.key) {
      return 0;
    }

    return left.key < right.key ? -1 : 1;
  });

  let dueNow = decimal('0');
  let overdueTotal = decimal('0');
  let daysPastDue = 0;

  let nextPaymentOn: LocalDate | null = null;
  let nextAmount = decimal('0');

  for (const state of states) {
    const remaining = decimal(state.remainingAmount);

    if (remaining.isZero()) {
      continue;
    }

    if (state.dueOn <= asOfOn) {
      dueNow = dueNow.plus(remaining);
    }

    if (state.status === 'OVERDUE') {
      overdueTotal = overdueTotal.plus(remaining);

      daysPastDue = Math.max(daysPastDue, state.daysPastDue);
    }

    if (state.dueOn > asOfOn) {
      if (nextPaymentOn === null) {
        nextPaymentOn = state.dueOn;
      }

      if (state.dueOn === nextPaymentOn) {
        nextAmount = nextAmount.plus(remaining);
      }
    }
  }

  return {
    asOfOn,
    obligations: states,

    dueNow: dueNow.toFixed(2),
    overdueTotal: overdueTotal.toFixed(2),
    daysPastDue,

    nextPaymentOn,

    nextPaymentAmount: nextPaymentOn === null ? null : nextAmount.toFixed(2),
  };
}
