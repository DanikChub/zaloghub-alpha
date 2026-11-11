import type { LocalDate } from '../finance.types.js';

import type { MissingPaymentDayPolicy } from './schedule.types.js';

import { daysInMonth, nextDay, validateLocalDate } from '../dates.js';

export function paymentDateInMonth(
  monthOf: LocalDate,
  paymentDay: number,
  missingDay: MissingPaymentDayPolicy,
): LocalDate {
  validateLocalDate(monthOf);

  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    throw new Error('День платежа должен быть целым числом от 1 до 31');
  }

  if (missingDay !== 'LAST_DAY_OF_MONTH' && missingDay !== 'REJECT') {
    throw new Error('Неизвестное правило отсутствующего дня');
  }

  const availableDays = daysInMonth(monthOf);

  if (paymentDay > availableDays && missingDay === 'REJECT') {
    throw new Error('В этом месяце отсутствует выбранный день платежа');
  }

  const actualDay = Math.min(paymentDay, availableDays);

  return monthOf.slice(0, 8) + String(actualDay).padStart(2, '0');
}

/** Находит ежемесячную дату строго после afterOn. */
export function nextMonthlyPaymentDate(
  afterOn: LocalDate,
  paymentDay: number,
  missingDay: MissingPaymentDayPolicy,
): LocalDate {
  const current = paymentDateInMonth(afterOn, paymentDay, missingDay);

  if (current > afterOn) {
    return current;
  }

  const lastDay = `${afterOn.slice(0, 8)}${daysInMonth(afterOn)}`;

  const firstDayOfNextMonth = nextDay(lastDay);

  return paymentDateInMonth(firstDayOfNextMonth, paymentDay, missingDay);
}
