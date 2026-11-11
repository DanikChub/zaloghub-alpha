import { Decimal } from 'decimal.js'
import type { Money } from './finance.types.js';

const FinanceDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export type MoneyRounding = 'HALF_UP' | 'HALF_EVEN' | 'DOWN';

const roundingModes = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  DOWN: Decimal.ROUND_DOWN,
} as const;

/** Преобразует десятичную строку в число для расчётов. */
export function decimal(value: string): Decimal {
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new Error(`Некорректное десятичное число: ${value}`);
  }

  return new FinanceDecimal(value);
}

/** Округляет сумму до копеек выбранным способом. */
export function formatMoney(value: Decimal, rounding: MoneyRounding): Money {
  if (!value.isFinite()) {
    throw new Error('Денежная сумма должна быть конечным числом');
  }

  const rounded = value.toDecimalPlaces(2, roundingModes[rounding]);

  return rounded.isZero() ? '0.00' : rounded.toFixed(2);
}
