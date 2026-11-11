import { describe, expect, it } from 'vitest';

import type { FinancialEvent, ReceiptEvent } from './finance.types.js';

import { validateEvents } from './validate-events.js';

function receipt(changes: Partial<ReceiptEvent> = {}): ReceiptEvent {
  return {
    id: 'receipt-1',
    kind: 'RECEIPT',
    effectiveOn: '2026-11-05',
    sequenceNo: 1,
    amount: '100.00',
    ...changes,
  };
}

function validate(value: unknown): void {
  validateEvents(value as readonly FinancialEvent[]);
}

describe('Проверка финансовых событий', () => {
  it('принимает пустую историю', () => {
    expect(() => validateEvents([])).not.toThrow();
  });

  it('принимает выдачу и поступление', () => {
    expect(() =>
      validateEvents([
        {
          id: 'disbursement-1',
          kind: 'DISBURSEMENT',
          effectiveOn: '2026-11-01',
          sequenceNo: 1,
          amount: '650000.00',
        },
        receipt(),
      ]),
    ).not.toThrow();
  });

  it('запрещает повторное включение одного события', () => {
    expect(() =>
      validateEvents([receipt(), receipt({ sequenceNo: 2 })]),
    ).toThrow('Повторный идентификатор');
  });

  it('запрещает одинаковые позиции внутри одной даты', () => {
    expect(() =>
      validateEvents([receipt(), receipt({ id: 'receipt-2' })]),
    ).toThrow('Повторный порядок');
  });

  it('разрешает одинаковый порядок в разные даты', () => {
    expect(() =>
      validateEvents([
        receipt(),
        receipt({
          id: 'receipt-2',
          effectiveOn: '2026-11-06',
        }),
      ]),
    ).not.toThrow();
  });

  it.each(['0', '-100', '1.001', '1e3', '1000000000000000000.00'])(
    'отклоняет сумму "%s"',
    (amount) => {
      expect(() => validateEvents([receipt({ amount })])).toThrow(
        'Некорректная сумма',
      );
    },
  );

  it('принимает максимальную сумму Decimal(20,2)', () => {
    expect(() =>
      validateEvents([receipt({ amount: '999999999999999999.99' })]),
    ).not.toThrow();
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'отклоняет порядок %s',
    (sequenceNo) => {
      expect(() => validateEvents([receipt({ sequenceNo })])).toThrow(
        'Некорректный порядок',
      );
    },
  );

  it('отклоняет несуществующую дату', () => {
    expect(() =>
      validateEvents([receipt({ effectiveOn: '2026-02-30' })]),
    ).toThrow();
  });

  it('отклоняет неизвестный тип события', () => {
    expect(() => validate([{ ...receipt(), kind: 'UNKNOWN' }])).toThrow(
      'Неподдерживаемый тип',
    );
  });

  it.each([null, undefined, {}, [null]])(
    'отклоняет неправильную структуру: %j',
    (value) => {
      expect(() => validate(value)).toThrow();
    },
  );
});
