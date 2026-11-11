import { describe, expect, it } from 'vitest';

import type { MonthlyInterestTerms } from './interest.types.js';

import { validateInterest } from './validate-interest.js';

const validInterest: MonthlyInterestTerms = {
  kind: 'MONTHLY',
  rate: '0.04',
  accrualBase: 'OUTSTANDING_PRINCIPAL',
  dailyRateDivisor: 'CALENDAR_MONTH_DAYS',
};

function validate(value: unknown): void {
  validateInterest(value as MonthlyInterestTerms);
}

describe('Проверка процентных условий', () => {
  it.each(['0', '0.04', '1.25', '0.0000000001'])(
    'принимает ставку %s',
    (rate) => {
      expect(() =>
        validate({
          ...validInterest,
          rate,
        }),
      ).not.toThrow();
    },
  );

  it('поддерживает фиксированный делитель 30', () => {
    expect(() =>
      validate({
        ...validInterest,
        dailyRateDivisor: 'FIXED_30_DAYS',
      }),
    ).not.toThrow();
  });

  it.each(['-0.04', '4%', '0,04', '1e-2', 'NaN', '0.00000000001', '100000000'])(
    'отклоняет некорректную ставку "%s"',
    (rate) => {
      expect(() =>
        validate({
          ...validInterest,
          rate,
        }),
      ).toThrow();
    },
  );

  it('отклоняет ставку, переданную числом', () => {
    expect(() =>
      validate({
        ...validInterest,
        rate: 0.04,
      }),
    ).toThrow();
  });

  it.each([
    { ...validInterest, kind: 'YEARLY' },
    { ...validInterest, accrualBase: 'CONTRACT_AMOUNT' },
    { ...validInterest, dailyRateDivisor: 'UNKNOWN' },
    null,
    undefined,
  ])('отклоняет неподдерживаемые условия: %j', (value) => {
    expect(() => validate(value)).toThrow();
  });
});
