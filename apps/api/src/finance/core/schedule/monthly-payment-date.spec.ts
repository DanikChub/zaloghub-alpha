import { describe, expect, it } from 'vitest';

import {
  nextMonthlyPaymentDate,
  paymentDateInMonth,
} from './monthly-payment-date.js';

describe('Ежемесячная дата платежа', () => {
  it.each([
    ['2026-11-10', 25, '2026-11-25'],
    ['2026-11-28', 25, '2026-12-25'],
    ['2026-11-25', 25, '2026-12-25'],
    ['2026-12-28', 25, '2027-01-25'],
  ])('после %s при дне %i следующая дата %s', (from, day, expected) => {
    expect(nextMonthlyPaymentDate(from, day, 'LAST_DAY_OF_MONTH')).toBe(
      expected,
    );
  });

  it('использует последний день короткого месяца', () => {
    expect(paymentDateInMonth('2026-02-01', 31, 'LAST_DAY_OF_MONTH')).toBe(
      '2026-02-28',
    );
  });

  it('учитывает високосный февраль', () => {
    expect(paymentDateInMonth('2028-02-01', 31, 'LAST_DAY_OF_MONTH')).toBe(
      '2028-02-29',
    );
  });

  it('возвращается к 31 числу после февраля', () => {
    expect(nextMonthlyPaymentDate('2026-02-28', 31, 'LAST_DAY_OF_MONTH')).toBe(
      '2026-03-31',
    );
  });

  it('позволяет запретить отсутствующий день', () => {
    expect(() => paymentDateInMonth('2026-02-01', 31, 'REJECT')).toThrow(
      'отсутствует',
    );
  });

  it.each([0, 32, 1.5])('отклоняет день %s', (day) => {
    expect(() =>
      paymentDateInMonth('2026-11-01', day, 'LAST_DAY_OF_MONTH'),
    ).toThrow();
  });

  it('отклоняет невозможную исходную дату', () => {
    expect(() =>
      nextMonthlyPaymentDate('2026-02-30', 25, 'LAST_DAY_OF_MONTH'),
    ).toThrow();
  });
});
