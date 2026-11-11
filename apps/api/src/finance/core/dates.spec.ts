import { describe, expect, it } from 'vitest';
import { daysBetween, daysInMonth, nextDay } from './dates.js';

describe('Календарные даты', () => {
  it.each([
    ['2026-11-01', '2026-11-05', 4],
    ['2026-11-01', '2026-11-01', 0],
    ['2026-11-05', '2026-11-01', -4],
    ['2026-12-31', '2027-01-01', 1],
    ['2028-02-28', '2028-03-01', 2],
  ])('между %s и %s — %i дней', (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected);
  });

  it.each([
    ['2026-02-10', 28],
    ['2028-02-10', 29],
    ['2026-04-15', 30],
    ['2026-01-31', 31],
  ])('в месяце даты %s — %i дней', (date, expected) => {
    expect(daysInMonth(date)).toBe(expected);
  });

  it.each([
    ['2026-11-05', '2026-11-06'],
    ['2026-12-31', '2027-01-01'],
    ['2028-02-28', '2028-02-29'],
    ['2028-02-29', '2028-03-01'],
  ])('после %s следует %s', (date, expected) => {
    expect(nextDay(date)).toBe(expected);
  });

  it.each([
    '',
    '05.11.2026',
    '2026-1-05',
    '2026-02-29',
    '2026-04-31',
    '0000-01-01',
  ])('отклоняет некорректную дату "%s"', (date) => {
    expect(() => daysInMonth(date)).toThrow();
  });

  it('не выходит за поддерживаемый диапазон дат', () => {
    expect(() => nextDay('9999-12-31')).toThrow();
  });
});
