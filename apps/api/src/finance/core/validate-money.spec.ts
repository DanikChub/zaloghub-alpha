import { describe, expect, it } from 'vitest';
import { validateMoney } from './validate-money.js';

describe('Проверка денежных сумм', () => {
  it.each(['0', '0.00', '1', '1.5', '1.50', '999999999999999999.99'])(
    'принимает допустимую сумму "%s"',
    (value) => {
      expect(() => validateMoney(value, true)).not.toThrow();
    },
  );

  it.each([
    '',
    '-1',
    '1,50',
    '1.001',
    '1e3',
    'NaN',
    'Infinity',
    '1000000000000000000.00',
  ])('отклоняет некорректную сумму "%s"', (value) => {
    expect(() => validateMoney(value, true)).toThrow();
  });

  it('запрещает нулевое поступление', () => {
    expect(() => validateMoney('0.00', false)).toThrow();
  });

  it('разрешает положительное поступление', () => {
    expect(() => validateMoney('0.01', false)).not.toThrow();
  });
});
