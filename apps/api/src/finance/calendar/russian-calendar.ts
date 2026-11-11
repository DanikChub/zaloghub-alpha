import { createHash } from 'node:crypto';
import { daysInMonth, validateLocalDate } from '../core/dates.js';

export interface RussianCalendarDay {
  date: string;
  isWorking: boolean;
  kind: 'WORKING' | 'DAY_OFF' | 'SHORTENED';
}
export const calendarSource = (year: number) =>
  `https://xmlcalendar.ru/data/ru/${year}/calendar.json`;
export const calendarXmlSource = (year: number) =>
  `https://raw.githubusercontent.com/xmlcalendar/data/master/ru/${year}/calendar.xml`;

/** JSON XMLCalendar перечисляет все нерабочие дни; * обозначает сокращённый рабочий. */
export function parseRussianCalendar(
  value: unknown,
  year: number,
): RussianCalendarDay[] {
  const data = value as {
    year?: number;
    months?: { month: number; days: string }[];
  };
  if (
    !data ||
    data.year !== year ||
    !Array.isArray(data.months) ||
    data.months.length !== 12
  )
    throw new Error('Неполный российский календарь');
  const result: RussianCalendarDay[] = [];
  const months = new Set<number>();
  for (const month of data.months) {
    if (
      !Number.isInteger(month.month) ||
      month.month < 1 ||
      month.month > 12 ||
      months.has(month.month) ||
      typeof month.days !== 'string'
    )
      throw new Error('Некорректный месяц календаря');
    months.add(month.month);
    const prefix = `${year}-${String(month.month).padStart(2, '0')}-`;
    const exceptions = new Map<number, boolean>();
    for (const token of month.days.split(',')) {
      if (!/^\d{1,2}[+*]?$/.test(token))
        throw new Error('Некорректный тип дня календаря');
      const number = Number.parseInt(token, 10);
      validateLocalDate(prefix + String(number).padStart(2, '0'));
      if (exceptions.has(number)) throw new Error('Повтор даты календаря');
      exceptions.set(number, token.endsWith('*'));
    }
    for (let day = 1; day <= daysInMonth(prefix + '01'); day++) {
      const isWorking = !exceptions.has(day) || exceptions.get(day)!;
      result.push({
        date: prefix + String(day).padStart(2, '0'),
        isWorking,
        kind: !isWorking
          ? 'DAY_OFF'
          : exceptions.has(day)
            ? 'SHORTENED'
            : 'WORKING',
      });
    }
  }
  result.sort((a, b) => a.date.localeCompare(b.date));
  return validateRussianDays(result, year);
}

function validateRussianDays(
  result: RussianCalendarDay[],
  year: number,
): RussianCalendarDay[] {
  const working = result.filter((d) => d.isWorking).length;
  if (working < 200 || working > 280)
    throw new Error('Неверное число рабочих дней РФ');
  for (const suffix of [
    '01-01',
    '01-02',
    '01-03',
    '01-04',
    '01-05',
    '01-06',
    '01-07',
    '01-08',
    '02-23',
    '03-08',
    '05-01',
    '05-09',
    '06-12',
    '11-04',
  ]) {
    if (result.find((d) => d.date === `${year}-${suffix}`)?.isWorking !== false)
      throw new Error('Отсутствует российский федеральный праздник');
  }
  return result;
}

/** Узкий формат доверенного XMLCalendar; DTD, entities и произвольный XML не поддерживаются. */
export function parseRussianCalendarXml(
  xml: string,
  year: number,
): RussianCalendarDay[] {
  if (
    xml.length > 100000 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    !xml.includes('</calendar>') ||
    !xml.includes('</days>')
  )
    throw new Error('Некорректный XML календаря');
  const attrs = (text: string) =>
    Object.fromEntries(
      [...text.matchAll(/\b(\w+)="([^"<>]*)"/g)].map((m) => [m[1], m[2]]),
    );
  const header = xml.match(/<calendar\b([^>]*)>/);
  if (!header || attrs(header[1]).year !== String(year))
    throw new Error('Неверный год XML календаря');
  const section = xml.match(/<days\b[^>]*>([\s\S]*?)<\/days>/)?.[1];
  if (!section) throw new Error('Нет исключений календаря');
  const exceptions = new Map<string, string>();
  const entries = [...section.matchAll(/<day\b([^>]*?)\/>/g)];
  if (entries.length !== (section.match(/<day\b/g) ?? []).length)
    throw new Error('Неверный элемент дня');
  for (const entry of entries) {
    const a = attrs(entry[1]);
    if (!/^\d{2}\.\d{2}$/.test(a.d) || !['1', '2', '3'].includes(a.t))
      throw new Error('Неверное исключение XML календаря');
    const day = `${year}-${a.d.replace('.', '-')}`;
    validateLocalDate(day);
    if (exceptions.has(day)) throw new Error('Повтор даты XML календаря');
    exceptions.set(day, a.t);
  }
  const days: RussianCalendarDay[] = [];
  for (let month = 1; month <= 12; month++) {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    for (let day = 1; day <= daysInMonth(prefix + '01'); day++) {
      const date = prefix + String(day).padStart(2, '0'),
        type = exceptions.get(date);
      const isWorking =
        type === '1'
          ? false
          : type === '2' || type === '3'
            ? true
            : ![0, 6].includes(new Date(date).getUTCDay());
      days.push({
        date,
        isWorking,
        kind: !isWorking ? 'DAY_OFF' : type === '2' ? 'SHORTENED' : 'WORKING',
      });
    }
  }
  return validateRussianDays(days, year);
}

export async function downloadRussianCalendar(year: number) {
  const errors: string[] = [];
  for (const [url, xml] of [
    [calendarXmlSource(year), true],
    [calendarSource(year), false],
  ] as const) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.length > 100000) throw new Error('Слишком большой календарь');
      return {
        sourceUrl: url,
        days: xml
          ? parseRussianCalendarXml(text, year)
          : parseRussianCalendar(JSON.parse(text), year),
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Ошибка источника');
    }
  }
  throw new Error(errors.join('; '));
}

export function contentHash(value: unknown): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v !== null && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, canonical(x)]),
          )
        : v;
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
