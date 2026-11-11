import type { FinanceCalculationInput } from './calculation-input.types.js';

import { validateLocalDate } from './dates.js';
import { validateEvents } from './validate-events.js';
import { validateInterest } from './validate-interest.js';
import { validatePenalty } from './validate-penalty.js';

export function validateInput(input: FinanceCalculationInput): void {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Вход расчёта должен быть объектом');
  }

  if (typeof input.loanId !== 'string' || input.loanId.trim().length === 0) {
    throw new Error('Не указан идентификатор займа');
  }

  if (input.currency !== 'RUB') {
    throw new Error('В первой версии поддерживается только RUB');
  }

  validateLocalDate(input.asOfOn);

  if (input.asOfOn === '9999-12-31') {
    throw new Error('Для расчёта требуется доступная следующая дата');
  }

  validateInterest(input.interest);
  validateEvents(input.events);

  if (input.penalty !== undefined) {
    validatePenalty(input.penalty);

    const hasReceipts = input.events.some(
      (event) => event.kind === 'RECEIPT' && event.effectiveOn <= input.asOfOn,
    );

    if (hasReceipts) {
      throw new Error('Пени с поступлениями пока не поддерживаются');
    }
  }

  const policy = input.policy;

  if (typeof policy !== 'object' || policy === null) {
    throw new Error('Не указана политика расчёта');
  }

  if (policy.interestRoundingMethod !== 'CUMULATIVE_TOTAL') {
    throw new Error('Неподдерживаемый момент округления');
  }

  if (
    policy.interestRoundingMode !== 'HALF_UP' &&
    policy.interestRoundingMode !== 'HALF_EVEN' &&
    policy.interestRoundingMode !== 'DOWN'
  ) {
    throw new Error('Неподдерживаемый способ округления');
  }

  if (
    policy.paymentAllocationOrder !== 'INTEREST_THEN_PRINCIPAL' &&
    policy.paymentAllocationOrder !== 'PRINCIPAL_THEN_INTEREST'
  ) {
    throw new Error('Неподдерживаемая очередность погашения');
  }

  if (
    policy.eventTiming !== 'BEFORE_DAILY_ACCRUAL' &&
    policy.eventTiming !== 'AFTER_DAILY_ACCRUAL'
  ) {
    throw new Error('Неподдерживаемый порядок обработки дня');
  }

  if (
    policy.principalRepayment !== 'ALLOWED' &&
    policy.principalRepayment !== 'BLOCKED'
  ) {
    throw new Error('Неподдерживаемое правило погашения тела');
  }

  if (policy.unappliedFunds !== 'HOLD') {
    throw new Error('Неподдерживаемое правило остатка поступления');
  }
}
