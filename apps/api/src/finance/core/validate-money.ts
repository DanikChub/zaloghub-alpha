import type { Money } from './finance.types.js';
import { decimal } from './money.js';

export function validateMoney(value: Money, allowZero: boolean): void {
  if (
    typeof value !== 'string' ||
    !/^(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(value)
  ) {
    throw new Error('Некорректная денежная сумма');
  }

  if (!allowZero && decimal(value).isZero()) {
    throw new Error('Денежная сумма должна быть больше нуля');
  }
}
