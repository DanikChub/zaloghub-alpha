import type { LocalDate } from './finance.types.js';



const DAY_MS = 86_400_000;

/** Проверяет календарную дату и создаёт её представление в UTC. */
function parseLocalDate(value: LocalDate): Date {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Некорректный формат даты: ${value}`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Несуществующая дата: ${value}`);
  }

  return date;
}

/**
 * Разница между датами в календарных днях.
 * Начало включается, конец не включается.
 */
export function daysBetween(
  fromOn: LocalDate,
  toOnExclusive: LocalDate,
): number {
  const from = parseLocalDate(fromOn);
  const to = parseLocalDate(toOnExclusive);

  return (to.getTime() - from.getTime()) / DAY_MS;
}

/** Количество дней в месяце указанной даты. */
export function daysInMonth(value: LocalDate): number {
  const date = parseLocalDate(value);

  date.setUTCMonth(date.getUTCMonth() + 1, 0);

  return date.getUTCDate();
}

/** Следующая календарная дата. */
export function nextDay(value: LocalDate): LocalDate {
  const date = parseLocalDate(value);

  date.setUTCDate(date.getUTCDate() + 1);

  if (date.getUTCFullYear() > 9999) {
    throw new Error('Дата выходит за поддерживаемый диапазон');
  }

  return date.toISOString().slice(0, 10);
}

export function validateLocalDate(value: LocalDate): void {
  parseLocalDate(value);
}
