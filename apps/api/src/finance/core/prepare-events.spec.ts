import { describe, expect, it } from 'vitest';

import type { DisbursementEvent } from './finance.types.js';

import { prepareEvents } from './prepare-events.js';

function event(
  id: string,
  effectiveOn: string,
  sequenceNo: number,
): DisbursementEvent {
  return {
    id,
    kind: 'DISBURSEMENT',
    effectiveOn,
    sequenceNo,
    amount: '100.00',
  };
}

describe('Подготовка событий', () => {
  it('сортирует сначала по дате, затем по порядку', () => {
    const result = prepareEvents(
      [
        event('third', '2026-11-02', 1),
        event('second', '2026-11-01', 2),
        event('first', '2026-11-01', 1),
      ],
      '2026-11-05',
    );

    expect(result.map((item) => item.id)).toEqual(['first', 'second', 'third']);
  });

  it('включает события даты расчёта и исключает будущее', () => {
    const result = prepareEvents(
      [
        event('before', '2026-11-04', 1),
        event('today', '2026-11-05', 1),
        event('future', '2026-11-06', 1),
      ],
      '2026-11-05',
    );

    expect(result.map((item) => item.id)).toEqual(['before', 'today']);
  });

  it('не изменяет исходную историю', () => {
    const events = [
      event('second', '2026-11-02', 1),
      event('first', '2026-11-01', 1),
    ];

    const original = structuredClone(events);

    prepareEvents(events, '2026-11-05');

    expect(events).toEqual(original);
  });

  it('возвращает пустой массив, если все события в будущем', () => {
    expect(
      prepareEvents([event('future', '2027-01-01', 1)], '2026-11-05'),
    ).toEqual([]);
  });

  it('проверяет даже исключаемые будущие события', () => {
    expect(() =>
      prepareEvents(
        [
          {
            ...event('future', '2027-01-01', 1),
            amount: '-100.00',
          },
        ],
        '2026-11-05',
      ),
    ).toThrow('Некорректная сумма');
  });

  it('отклоняет неправильную дату расчёта', () => {
    expect(() => prepareEvents([], '2026-02-30')).toThrow();
  });
});
