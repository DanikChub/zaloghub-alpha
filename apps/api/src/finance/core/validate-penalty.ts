import type { FixedDailyPenaltyTerms } from './penalty.types.js';

import { validateMoney } from './validate-money.js';
import { validateLocalDate } from './dates.js';

export function validatePenalty(terms: FixedDailyPenaltyTerms): void {
  if (typeof terms !== 'object' || terms === null) {
    throw new Error('Условия пени должны быть объектом');
  }

  if (terms.kind !== 'FIXED_DAILY') {
    throw new Error('Неподдерживаемый вид пени');
  }

  validateMoney(terms.baseAmount, true);

  if (
    typeof terms.dailyRate !== 'string' ||
    !/^(0|[1-9]\d{0,7})(\.\d{1,10})?$/.test(terms.dailyRate)
  ) {
    throw new Error('Некорректная дневная ставка пени');
  }

  validateLocalDate(terms.fromOn);

  if (terms.toOnExclusive !== null) {
    validateLocalDate(terms.toOnExclusive);

    if (terms.toOnExclusive <= terms.fromOn) {
      throw new Error('Конец периода пени должен быть позже начала');
    }
  }

  if (
    terms.roundingMode !== 'HALF_UP' &&
    terms.roundingMode !== 'HALF_EVEN' &&
    terms.roundingMode !== 'DOWN'
  ) {
    throw new Error('Неподдерживаемое округление пени');
  }
}
