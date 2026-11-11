import { describe, expect, it } from 'vitest';

import type { InterestScheduleInput } from './schedule.types.js';

import { buildInterestSchedule } from './build-interest-schedule.js';

function input(
  changes: Partial<InterestScheduleInput> = {},
): InterestScheduleInput {
  return {
    accrualStartOn: '2026-11-10',
    firstPaymentOn: '2026-11-25',

    paymentDay: 25,
    maturityOn: '2027-01-25',

    missingPaymentDay: 'LAST_DAY_OF_MONTH',

    ...changes,
  };
}

describe('Календарь процентных периодов', () => {
  it('строит первый период 15 дней и последующие месяцы', () => {
    const result = buildInterestSchedule(input());

    expect(
      result.map((period) => [
        period.fromOn,
        period.dueOn,
        period.days,
        period.isFullMonthlyPeriod,
      ]),
    ).toEqual([
      ['2026-11-10', '2026-11-25', 15, false],
      ['2026-11-25', '2026-12-25', 30, true],
      ['2026-12-25', '2027-01-25', 31, true],
    ]);

    expect(result[0].isFirst).toBe(true);
    expect(result[2].isFinal).toBe(true);
  });

  it('строит первый период 27 дней при выдаче 28 ноября', () => {
    const result = buildInterestSchedule(
      input({
        accrualStartOn: '2026-11-28',
        firstPaymentOn: '2026-12-25',
      }),
    );

    expect(result[0]).toMatchObject({
      fromOn: '2026-11-28',
      dueOn: '2026-12-25',
      days: 27,
      isFirst: true,
      isFullMonthlyPeriod: false,
    });
  });

  it('поддерживает настраиваемый день оплаты', () => {
    const result = buildInterestSchedule(
      input({
        accrualStartOn: '2026-11-01',
        firstPaymentOn: '2026-11-10',
        paymentDay: 10,
        maturityOn: '2027-01-10',
      }),
    );

    expect(result.map((period) => period.dueOn)).toEqual([
      '2026-11-10',
      '2026-12-10',
      '2027-01-10',
    ]);
  });

  it('закрывает последний неполный период в дату возврата', () => {
    const result = buildInterestSchedule(
      input({
        maturityOn: '2027-01-10',
      }),
    );

    expect(result.at(-1)).toMatchObject({
      fromOn: '2026-12-25',
      dueOn: '2027-01-10',
      days: 16,
      isFinal: true,
      isFullMonthlyPeriod: false,
    });
  });

  it('поддерживает один первый и одновременно последний период', () => {
    const result = buildInterestSchedule(
      input({
        maturityOn: '2026-11-20',
      }),
    );

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      dueOn: '2026-11-20',
      days: 10,
      isFirst: true,
      isFinal: true,
    });
  });

  it('не сдвигает день оплаты навсегда после короткого месяца', () => {
    const result = buildInterestSchedule(
      input({
        accrualStartOn: '2026-01-10',
        firstPaymentOn: '2026-01-31',
        paymentDay: 31,
        maturityOn: '2026-04-30',
      }),
    );

    expect(result.map((period) => period.dueOn)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);

    expect(result.map((period) => period.days)).toEqual([21, 28, 31, 30]);

    expect(result.map((period) => period.isFullMonthlyPeriod)).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });

  it('не создаёт пропусков или пересечений периодов', () => {
    const result = buildInterestSchedule(input());

    for (let index = 1; index < result.length; index += 1) {
      expect(result[index].fromOn).toBe(result[index - 1].toOnExclusive);
    }

    const keys = result.map((period) => period.key);

    expect(new Set(keys).size).toBe(result.length);
  });

  it('не меняет вход', () => {
    const source = input();
    const original = structuredClone(source);

    buildInterestSchedule(source);

    expect(source).toEqual(original);
  });

  it('не допускает первый срок до начала начисления', () => {
    expect(() =>
      buildInterestSchedule(
        input({
          firstPaymentOn: '2026-10-25',
        }),
      ),
    ).toThrow();
  });

  it('проверяет соответствие первой даты выбранному дню', () => {
    expect(() =>
      buildInterestSchedule(
        input({
          firstPaymentOn: '2026-11-26',
        }),
      ),
    ).toThrow('не соответствует');
  });

  it('не создаёт период после даты возврата', () => {
    expect(() =>
      buildInterestSchedule(
        input({
          maturityOn: '2026-11-01',
        }),
      ),
    ).toThrow();
  });

  it('поддерживает заключительный отрезок у верхней границы дат', () => {
    const result = buildInterestSchedule(
      input({
        accrualStartOn: '9999-12-10',
        firstPaymentOn: '9999-12-25',
        maturityOn: '9999-12-30',
      }),
    );

    expect(result.map((period) => period.dueOn)).toEqual([
      '9999-12-25',
      '9999-12-30',
    ]);
  });
});
