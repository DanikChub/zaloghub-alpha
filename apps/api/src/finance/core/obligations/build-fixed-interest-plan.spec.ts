import { describe, expect, it } from 'vitest';

import type { FixedInterestPlanInput } from './obligation.types.js';

import { buildInterestSchedule } from '../schedule/build-interest-schedule.js';
import { buildFixedInterestPlan } from './build-fixed-interest-plan.js';

function input(): FixedInterestPlanInput {
  return {
    periods: buildInterestSchedule({
      accrualStartOn: '2026-11-10',
      firstPaymentOn: '2026-11-25',
      paymentDay: 25,
      maturityOn: '2027-01-25',
      missingPaymentDay: 'LAST_DAY_OF_MONTH',
    }),

    principal: '100000.00',

    terms: {
      kind: 'MONTHLY',
      rate: '0.04',
      accrualBase: 'OUTSTANDING_PRINCIPAL',
      dailyRateDivisor: 'FIXED_30_DAYS',
    },

    roundingMode: 'HALF_UP',
  };
}

describe('План процентов при постоянном теле', () => {
  it('считает короткий первый период, затем 30 и 31 день', () => {
    expect(
      buildFixedInterestPlan(input()).map((obligation) => obligation.amount),
    ).toEqual(['2000.00', '4000.00', '4133.33']);
  });

  it('считает первый период 27 дней', () => {
    const source = input();

    const periods = buildInterestSchedule({
      accrualStartOn: '2026-11-28',
      firstPaymentOn: '2026-12-25',
      paymentDay: 25,
      maturityOn: '2027-01-25',
      missingPaymentDay: 'LAST_DAY_OF_MONTH',
    });

    expect(
      buildFixedInterestPlan({
        ...source,
        periods,
      }).map((obligation) => obligation.amount),
    ).toEqual(['3600.00', '4133.33']);
  });

  it('сохраняет дробные копейки между обязательствами', () => {
    const source = input();

    const result = buildFixedInterestPlan({
      ...source,
      periods: source.periods.slice(0, 2),
      principal: '1.00',

      terms: {
        ...source.terms,
        rate: '0.004',
      },
    });

    expect(result.map((obligation) => obligation.amount)).toEqual([
      '0.00',
      '0.01',
    ]);
  });

  it('не допускает разрывов календаря', () => {
    const source = input();

    expect(() =>
      buildFixedInterestPlan({
        ...source,
        periods: [source.periods[0], source.periods[2]],
      }),
    ).toThrow('разрывов');
  });

  it('не допускает повторных ключей', () => {
    const source = input();

    const periods = source.periods.map((period, index) =>
      index === 1 ? { ...period, key: source.periods[0].key } : period,
    );

    expect(() =>
      buildFixedInterestPlan({
        ...source,
        periods,
      }),
    ).toThrow('Повторное обязательство');
  });

  it('отклоняет отрицательное тело', () => {
    expect(() =>
      buildFixedInterestPlan({
        ...input(),
        principal: '-1.00',
      }),
    ).toThrow();
  });

  it('возвращает пустой план без периодов', () => {
    expect(
      buildFixedInterestPlan({
        ...input(),
        periods: [],
      }),
    ).toEqual([]);
  });

  it('не изменяет исходные условия', () => {
    const source = input();
    const original = structuredClone(source);

    buildFixedInterestPlan(source);

    expect(source).toEqual(original);
  });
});
