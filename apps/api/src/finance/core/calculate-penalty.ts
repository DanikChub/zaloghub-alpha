import type { LocalDate, Money } from './finance.types.js';

import type { FixedDailyPenaltyTerms } from './penalty.types.js';

import { daysBetween, nextDay, validateLocalDate } from './dates.js';

import { decimal, formatMoney } from './money.js';
import { validatePenalty } from './validate-penalty.js';

export function calculatePenalty(
  terms: FixedDailyPenaltyTerms,
  asOfOn: LocalDate,
): Money {
  validatePenalty(terms);
  validateLocalDate(asOfOn);

  const calculationEnd = nextDay(asOfOn);

  const end =
    terms.toOnExclusive !== null && terms.toOnExclusive < calculationEnd
      ? terms.toOnExclusive
      : calculationEnd;

  if (end <= terms.fromOn) {
    return '0.00';
  }

  const days = daysBetween(terms.fromOn, end);

  const amount = decimal(terms.baseAmount).times(terms.dailyRate).times(days);

  return formatMoney(amount, terms.roundingMode);
}
