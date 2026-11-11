import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const ru2025 = readFileSync(
  new URL('./fixtures/ru-2025.xml', import.meta.url),
  'utf8',
);
const ru2026 = readFileSync(
  new URL('./fixtures/ru-2026.xml', import.meta.url),
  'utf8',
);
import {
  parseRussianCalendar,
  parseRussianCalendarXml,
  downloadRussianCalendar,
  calendarSource,
  contentHash,
} from './russian-calendar.js';

describe('Федеральный производственный календарь РФ', () => {
  const days2025 = parseRussianCalendarXml(ru2025, 2025),
    days2026 = parseRussianCalendarXml(ru2026, 2026);
  const json2026 = {
    year: 2026,
    months: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      days: days2026
        .filter(
          (d) => Number(d.date.slice(5, 7)) === i + 1 && d.kind !== 'WORKING',
        )
        .map(
          (d) =>
            String(Number(d.date.slice(8))) +
            (d.kind === 'SHORTENED' ? '*' : d.date === '2026-01-09' ? '+' : ''),
        )
        .join(','),
    })),
  };
  it('XML и резервный JSON дают одинаковую версию рабочих дней', () => {
    expect(contentHash(parseRussianCalendar(json2026, 2026))).toBe(
      contentHash(days2026),
    );
  });
  it('при недоступности репозитория использует резервный источник того же проекта', async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify(json2026)));
    vi.stubGlobal('fetch', mock);
    try {
      const result = await downloadRussianCalendar(2026);
      expect(result.sourceUrl).toBe(calendarSource(2026));
      expect(result.days).toEqual(days2026);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('содержит каждый день года ровно один раз', () => {
    expect(days2025).toHaveLength(365);
    expect(new Set(days2025.map((d) => d.date)).size).toBe(365);
  });
  it('учитывает рабочую сокращённую субботу 1 ноября 2025', () => {
    expect(days2025.find((d) => d.date === '2025-11-01')).toMatchObject({
      isWorking: true,
      kind: 'SHORTENED',
    });
  });
  it('учитывает перенос с 1 ноября на 3 ноября 2025', () => {
    expect(days2025.find((d) => d.date === '2025-11-03')?.isWorking).toBe(
      false,
    );
  });
  it.each([
    '2026-01-09',
    '2026-03-09',
    '2026-05-11',
    '2026-12-31',
    '2026-11-04',
  ])('учитывает праздник или перенос %s', (date) => {
    expect(days2026.find((d) => d.date === date)?.isWorking).toBe(false);
  });
  it('считает сокращённый день рабочим для пятидневной льготы', () => {
    expect(days2026.find((d) => d.date === '2026-11-03')).toMatchObject({
      isWorking: true,
      kind: 'SHORTENED',
    });
  });
  it('отклоняет неполный год вместо подстановки будних дней', () => {
    expect(() =>
      parseRussianCalendar({ year: 2026, months: [] }, 2026),
    ).toThrow();
  });
  it('отклоняет календарь без российских праздников', () => {
    expect(() =>
      parseRussianCalendar(
        {
          year: 2026,
          months: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            days: '1',
          })),
        },
        2026,
      ),
    ).toThrow();
  });
});
