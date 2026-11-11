import type { Decimal } from 'decimal.js';

import type { InterestPeriodInput } from './interest-period.types.js';

import { daysBetween, daysInMonth, nextDay } from './dates.js';

import { decimal } from './money.js';
import { validateInterest } from './validate-interest.js';

export function calculatePeriodInterest(input: InterestPeriodInput): Decimal {
  const { principal, fromOn, toOnExclusive, terms } = input;

  validateInterest(terms);

  const totalDays = daysBetween(fromOn, toOnExclusive);

  if (totalDays < 0) {
    throw new Error('Конец периода раньше его начала');
  }

  if (
    typeof principal !== 'string' ||
    !/^(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(principal)
  ) {
    throw new Error('Некорректный остаток основного долга');
  }

  const base = decimal(principal);
  const rate = decimal(terms.rate);

  if (totalDays === 0 || base.isZero() || rate.isZero()) {
    return decimal('0');
  }

  const monthlyInterest = base.times(rate);

  if (terms.dailyRateDivisor === 'FIXED_30_DAYS') {
    return monthlyInterest.times(totalDays).div('30');
  }

  let cursor = fromOn;
  let result = decimal('0');

  while (cursor < toOnExclusive) {
    const monthDays = daysInMonth(cursor);
    let segmentEnd = toOnExclusive;

    // Если конец находится в другом месяце,
    // ограничиваем участок началом следующего месяца.
    if (cursor.slice(0, 7) !== toOnExclusive.slice(0, 7)) {
      const lastDayOfMonth = `${cursor.slice(0, 7)}-${monthDays}`;

      segmentEnd = nextDay(lastDayOfMonth);
    }

    const segmentDays = daysBetween(cursor, segmentEnd);

    const segmentInterest = monthlyInterest.times(segmentDays).div(monthDays);

    result = result.plus(segmentInterest);
    cursor = segmentEnd;
  }

  return result;
}
