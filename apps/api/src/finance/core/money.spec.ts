import { describe, expect, it } from 'vitest';
import { decimal, formatMoney } from './money.js';

describe('Денежная арифметика', () => {
  it('складывает десятичные суммы без ошибки number', () => {
    const result = decimal('0.1').plus(decimal('0.2'));

    expect(result.equals('0.3')).toBe(true);
  });

  it('при HALF_UP округляет половину вверх для положительной суммы', () => {
    expect(formatMoney(decimal('1.005'), 'HALF_UP')).toBe('1.01');
  });

  it('при HALF_EVEN округляет половину к чётной цифре', () => {
    expect(formatMoney(decimal('1.005'), 'HALF_EVEN')).toBe('1.00');

    expect(formatMoney(decimal('1.015'), 'HALF_EVEN')).toBe('1.02');
  });

  it('при DOWN отбрасывает дробные копейки в направлении нуля', () => {
    expect(formatMoney(decimal('1.009'), 'DOWN')).toBe('1.00');

    expect(formatMoney(decimal('-1.009'), 'DOWN')).toBe('-1.00');
  });

  it('не возвращает отрицательный ноль', () => {
    expect(formatMoney(decimal('-0.001'), 'HALF_UP')).toBe('0.00');
  });

  it('отклоняет строки неподдерживаемого формата', () => {
    for (const value of ['', '1,50', 'NaN', 'Infinity', '1e3']) {
      expect(() => decimal(value)).toThrow();
    }
  });
});
