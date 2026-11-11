import { describe, expect, it } from 'vitest';

import type { InterestPeriodInput } from './interest-period.types.js';

import { calculatePeriodInterest } from './calculate-period-interest.js';
import { formatMoney } from './money.js';

function period(
  changes: Partial<InterestPeriodInput> = {},
): InterestPeriodInput {
  return {
    principal: '650000.00',
    fromOn: '2026-11-01',
    toOnExclusive: '2026-12-01',

    terms: {
      kind: 'MONTHLY',
      rate: '0.04',
      accrualBase: 'OUTSTANDING_PRINCIPAL',
      dailyRateDivisor: 'CALENDAR_MONTH_DAYS',
    },

    ...changes,
  };
}

function amount(input: InterestPeriodInput): string {
  return formatMoney(calculatePeriodInterest(input), 'HALF_UP');
}

describe('Начисление процентов за период', () => {
  it('начисляет 4% за полный ноябрь', () => {
    expect(amount(period())).toBe('26000.00');
  });

  it.each([
    ['2026-02-01', '2026-03-01'],
    ['2028-02-01', '2028-03-01'],
    ['2026-01-01', '2026-02-01'],
  ])('начисляет полную месячную ставку за %s — %s', (fromOn, toOnExclusive) => {
    expect(
      amount(
        period({
          fromOn,
          toOnExclusive,
        }),
      ),
    ).toBe('26000.00');
  });

  it('начисляет проценты за пять дней ноября', () => {
    expect(
      amount(
        period({
          toOnExclusive: '2026-11-06',
        }),
      ),
    ).toBe('4333.33');
  });

  it('разделяет начисление на границе месяцев', () => {
    expect(
      amount(
        period({
          fromOn: '2026-01-31',
          toOnExclusive: '2026-02-02',
        }),
      ),
    ).toBe('1767.28');
  });

  it('использует фиксированный делитель 30, если он выбран', () => {
    const input = period({
      fromOn: '2026-02-01',
      toOnExclusive: '2026-03-01',
    });

    expect(
      amount({
        ...input,
        terms: {
          ...input.terms,
          dailyRateDivisor: 'FIXED_30_DAYS',
        },
      }),
    ).toBe('24266.67');
  });

  it('не округляет промежуточное начисление до копеек', () => {
    const result = calculatePeriodInterest(
      period({
        principal: '1.00',
        toOnExclusive: '2026-11-02',
      }),
    );

    expect(result.greaterThan('0')).toBe(true);
    expect(result.lessThan('0.01')).toBe(true);
  });

  it('возвращает ноль для периода без дней', () => {
    expect(
      amount(
        period({
          toOnExclusive: '2026-11-01',
        }),
      ),
    ).toBe('0.00');
  });

  it('возвращает ноль при отсутствии основного долга', () => {
    expect(
      amount(
        period({
          principal: '0.00',
        }),
      ),
    ).toBe('0.00');
  });

  it('возвращает ноль для беспроцентного займа', () => {
    const input = period();

    expect(
      amount({
        ...input,
        terms: {
          ...input.terms,
          rate: '0',
        },
      }),
    ).toBe('0.00');
  });

  it('отклоняет обратный период', () => {
    expect(() =>
      calculatePeriodInterest(
        period({
          toOnExclusive: '2026-10-31',
        }),
      ),
    ).toThrow('Конец периода раньше');
  });

  it.each(['-1.00', '1.001'])(
    'отклоняет некорректное тело "%s"',
    (principal) => {
      expect(() =>
        calculatePeriodInterest(
          period({
            principal,
          }),
        ),
      ).toThrow('Некорректный остаток');
    },
  );
});
