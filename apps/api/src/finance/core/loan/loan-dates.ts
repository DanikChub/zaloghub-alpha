import type { LocalDate } from '../finance.types.js';
import { daysInMonth, validateLocalDate } from '../dates.js';

export function addMonthsClamped(day: LocalDate, months: number): LocalDate {
  validateLocalDate(day);
  if (!Number.isSafeInteger(months) || months < 0)
    throw new Error('Некорректное число месяцев');
  const [year, month, date] = day.split('-').map(Number);
  const index = year * 12 + month - 1 + months;
  const nextYear = Math.floor(index / 12);
  if (nextYear > 9999)
    throw new Error('Дата выходит за поддерживаемый диапазон');
  const first = `${String(nextYear).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}-01`;
  return `${first.slice(0, 8)}${String(Math.min(date, daysInMonth(first))).padStart(2, '0')}`;
}
