import type { ReceiptAllocationPolicy } from './receipt-allocation.types.js';

import type {
  ObligationComponent,
  ObligationSnapshot,
  ObligationState,
} from './obligation.types.js';

import { decimal } from '../money.js';

export function validateReceiptAllocationPolicy(
  policy: ReceiptAllocationPolicy,
): void {
  if (typeof policy !== 'object' || policy === null) {
    throw new Error('Не указана политика распределения');
  }

  const components: readonly ObligationComponent[] = [
    'PENALTY',
    'INTEREST',
    'PRINCIPAL',
    'EXPENSE',
  ];

  if (
    !Array.isArray(policy.componentOrder) ||
    policy.componentOrder.length !== components.length ||
    new Set(policy.componentOrder).size !== components.length ||
    policy.componentOrder.some((component) => !components.includes(component))
  ) {
    throw new Error('Нужно указать все компоненты погашения без повторов');
  }

  if (policy.priority !== 'DUE_FIRST') {
    throw new Error('Неподдерживаемый приоритет обязательств');
  }

  if (
    policy.earlyInterest !== 'CURRENT_PERIOD' &&
    policy.earlyInterest !== 'NONE'
  ) {
    throw new Error('Неподдерживаемое правило ранней оплаты процентов');
  }

  if (
    policy.earlyPrincipal !== 'ALLOWED' &&
    policy.earlyPrincipal !== 'BLOCKED'
  ) {
    throw new Error('Неподдерживаемое правило ранней оплаты тела');
  }

  if (policy.unappliedFunds !== 'HOLD') {
    throw new Error('Неподдерживаемое правило остатка поступления');
  }
}

export function selectReceiptTargets(
  snapshot: ObligationSnapshot,
  policy: ReceiptAllocationPolicy,
): readonly ObligationState[] {
  validateReceiptAllocationPolicy(policy);

  const targets = snapshot.obligations.filter((state) => {
    if (decimal(state.remainingAmount).isZero()) {
      return false;
    }

    // Срок наступил: обязательство доступно для погашения.
    if (state.dueOn <= snapshot.asOfOn) {
      return true;
    }

    if (state.component === 'PRINCIPAL') {
      return policy.earlyPrincipal === 'ALLOWED';
    }

    if (state.component !== 'INTEREST' || policy.earlyInterest === 'NONE') {
      return false;
    }

    if (state.periodFromOn === null || state.periodToOnExclusive === null) {
      throw new Error('Для ранней оплаты процентов нужны границы периода');
    }

    return (
      state.periodFromOn <= snapshot.asOfOn &&
      snapshot.asOfOn < state.periodToOnExclusive
    );
  });

  return targets.sort((left, right) => {
    // Наступившие обязательства раньше предоплаты будущих.
    const leftGroup = left.dueOn <= snapshot.asOfOn ? 0 : 1;

    const rightGroup = right.dueOn <= snapshot.asOfOn ? 0 : 1;

    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup;
    }

    const componentRank =
      policy.componentOrder.indexOf(left.component) -
      policy.componentOrder.indexOf(right.component);

    if (componentRank !== 0) {
      return componentRank;
    }

    if (left.dueOn !== right.dueOn) {
      return left.dueOn < right.dueOn ? -1 : 1;
    }

    if (left.key === right.key) {
      return 0;
    }

    return left.key < right.key ? -1 : 1;
  });
}
