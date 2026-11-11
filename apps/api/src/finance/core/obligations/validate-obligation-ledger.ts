import type {
  PaymentObligation,
  ObligationAllocation,
  ObligationComponent,
} from './obligation.types.js';

import { daysBetween, validateLocalDate } from '../dates.js';

import { validateMoney } from '../validate-money.js';

function requireText(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Не заполнено поле: ${label}`);
  }
}

export function validateObligationLedger(
  obligations: readonly PaymentObligation[],
  allocations: readonly ObligationAllocation[],
): void {
  if (!Array.isArray(obligations) || !Array.isArray(allocations)) {
    throw new Error('Обязательства и распределения должны быть массивами');
  }

  const keys = new Set<string>();

  const components: readonly ObligationComponent[] = [
    'PRINCIPAL',
    'INTEREST',
    'PENALTY',
    'EXPENSE',
  ];

  for (const obligation of obligations) {
    if (typeof obligation !== 'object' || obligation === null) {
      throw new Error('Обязательство должно быть объектом');
    }

    requireText(obligation.key, 'key');

    if (keys.has(obligation.key)) {
      throw new Error(`Повторное обязательство: ${obligation.key}`);
    }

    if (!components.includes(obligation.component)) {
      throw new Error('Неизвестный компонент обязательства');
    }

    validateLocalDate(obligation.dueOn);
    validateMoney(obligation.amount, true);

    const from = obligation.periodFromOn;
    const to = obligation.periodToOnExclusive;

    if ((from === null) !== (to === null)) {
      throw new Error('У периода должны быть обе границы');
    }

    if (from !== null && to !== null) {
      validateLocalDate(from);
      validateLocalDate(to);

      if (daysBetween(from, to) <= 0) {
        throw new Error(
          'Период обязательства должен иметь положительную длительность',
        );
      }
    }

    keys.add(obligation.key);
  }

  const allocationIds = new Set<string>();
  const positions = new Set<string>();

  for (const allocation of allocations) {
    if (typeof allocation !== 'object' || allocation === null) {
      throw new Error('Распределение должно быть объектом');
    }

    requireText(allocation.id, 'allocation.id');
    requireText(allocation.paymentId, 'paymentId');
    requireText(allocation.obligationKey, 'obligationKey');

    if (allocationIds.has(allocation.id)) {
      throw new Error(`Повторное распределение: ${allocation.id}`);
    }

    if (!keys.has(allocation.obligationKey)) {
      throw new Error(`Неизвестное обязательство: ${allocation.obligationKey}`);
    }

    if (!Number.isSafeInteger(allocation.orderNo) || allocation.orderNo < 1) {
      throw new Error('Некорректный порядок распределения');
    }

    const position = `${allocation.paymentId}:${allocation.orderNo}`;

    if (positions.has(position)) {
      throw new Error('Повторный порядок распределения платежа');
    }

    validateLocalDate(allocation.effectiveOn);
    validateMoney(allocation.amount, false);

    allocationIds.add(allocation.id);
    positions.add(position);
  }
}
