import { describe, expect, it } from 'vitest';

import type { ReceiptEvent } from '../finance.types.js';

import type { PaymentObligation } from './obligation.types.js';

import type {
  ReplayReceiptsInput,
  ReceiptAllocationPolicy,
} from './receipt-allocation.types.js';

import { replayReceipts } from './replay-receipts.js';

const policy: ReceiptAllocationPolicy = {
  priority: 'DUE_FIRST',

  componentOrder: ['PENALTY', 'INTEREST', 'PRINCIPAL', 'EXPENSE'],

  earlyInterest: 'CURRENT_PERIOD',
  earlyPrincipal: 'BLOCKED',
  unappliedFunds: 'HOLD',
};

function obligation(
  changes: Partial<PaymentObligation> = {},
): PaymentObligation {
  return {
    key: 'interest',
    component: 'INTEREST',
    dueOn: '2026-11-25',
    amount: '30000.00',

    periodFromOn: '2026-11-01',
    periodToOnExclusive: '2026-11-25',

    ...changes,
  };
}

function receipt(
  id: string,
  effectiveOn: string,
  amount: string,
  sequenceNo = 1,
): ReceiptEvent {
  return {
    id,
    kind: 'RECEIPT',
    effectiveOn,
    amount,
    sequenceNo,
  };
}

function input(
  changes: Partial<ReplayReceiptsInput> = {},
): ReplayReceiptsInput {
  return {
    obligations: [obligation()],
    receipts: [],
    asOfOn: '2026-11-28',
    policy,
    ...changes,
  };
}

describe('Пересчёт истории поступлений', () => {
  it('суммирует частичные оплаты и показывает недоплату 4000', () => {
    const result = replayReceipts(
      input({
        receipts: [
          receipt('first', '2026-11-20', '20000.00'),
          receipt('second', '2026-11-24', '6000.00'),
        ],
      }),
    );

    expect(result.receivedTotal).toBe('26000.00');
    expect(result.snapshot.overdueTotal).toBe('4000.00');
    expect(result.snapshot.daysPastDue).toBe(3);
  });

  it('считает ранний полный платёж оплатой первого периода', () => {
    const future = obligation({
      key: 'future',
      dueOn: '2026-12-25',
      amount: '4000.00',
      periodFromOn: '2026-11-25',
      periodToOnExclusive: '2026-12-25',
    });

    const result = replayReceipts(
      input({
        obligations: [obligation(), future],

        receipts: [receipt('early', '2026-11-20', '30000.00')],

        asOfOn: '2026-11-21',
      }),
    );

    expect(result.snapshot.nextPaymentOn).toBe('2026-12-25');

    expect(result.snapshot.nextPaymentAmount).toBe('4000.00');
  });

  it('обрабатывает платёж задним числом через воспроизведение всей истории', () => {
    const penalty = obligation({
      key: 'penalty',
      component: 'PENALTY',
      amount: '1000.00',
      dueOn: '2026-11-28',
      periodFromOn: null,
      periodToOnExclusive: null,
    });

    const result = replayReceipts(
      input({
        obligations: [obligation(), penalty],

        receipts: [
          receipt('late', '2026-11-28', '5000.00'),
          receipt('early', '2026-11-20', '26000.00'),
        ],
      }),
    );

    expect(result.payments.map((payment) => payment.paymentId)).toEqual([
      'early',
      'late',
    ]);

    expect(result.snapshot.overdueTotal).toBe('0.00');
    expect(result.unappliedCredit).toBe('0.00');
  });

  it('не расходует удержанный остаток автоматически в будущую дату', () => {
    const future = obligation({
      key: 'future',
      dueOn: '2026-12-25',
      amount: '4000.00',
      periodFromOn: '2026-11-25',
      periodToOnExclusive: '2026-12-25',
    });

    const result = replayReceipts(
      input({
        obligations: [obligation(), future],

        receipts: [receipt('early', '2026-11-20', '35000.00')],

        asOfOn: '2026-12-25',
      }),
    );

    expect(result.unappliedCredit).toBe('5000.00');
    expect(result.snapshot.dueNow).toBe('4000.00');
  });

  it('исключает будущие поступления', () => {
    const result = replayReceipts(
      input({
        receipts: [
          receipt('early', '2026-11-20', '26000.00'),
          receipt('future', '2026-11-29', '4000.00'),
        ],
      }),
    );

    expect(result.payments).toHaveLength(1);
    expect(result.receivedTotal).toBe('26000.00');
    expect(result.snapshot.overdueTotal).toBe('4000.00');
  });

  it('не допускает повторный идентификатор даже без распределений', () => {
    expect(() =>
      replayReceipts(
        input({
          obligations: [],

          receipts: [
            receipt('same', '2026-11-20', '100.00'),
            receipt('same', '2026-11-21', '100.00'),
          ],
        }),
      ),
    ).toThrow('Повторный идентификатор');
  });

  it('учитывает sequenceNo при равной дате', () => {
    const result = replayReceipts(
      input({
        receipts: [
          receipt('second', '2026-11-20', '1000.00', 2),
          receipt('first', '2026-11-20', '30000.00', 1),
        ],
      }),
    );

    expect(result.payments.map((payment) => payment.paymentId)).toEqual([
      'first',
      'second',
    ]);

    expect(result.payments[1].unallocatedAmount).toBe('1000.00');
  });

  it('даёт одинаковый результат при повторном пересчёте', () => {
    const source = input({
      receipts: [receipt('first', '2026-11-20', '26000.00')],
    });

    expect(replayReceipts(source)).toEqual(replayReceipts(source));
  });

  it('не меняет исходную историю', () => {
    const source = input({
      receipts: [receipt('first', '2026-11-20', '26000.00')],
    });

    const original = structuredClone(source);

    replayReceipts(source);

    expect(source).toEqual(original);
  });

  it('возвращает план без поступлений', () => {
    const result = replayReceipts(
      input({
        asOfOn: '2026-11-20',
      }),
    );

    expect(result.receivedTotal).toBe('0.00');
    expect(result.unappliedCredit).toBe('0.00');

    expect(result.snapshot.nextPaymentAmount).toBe('30000.00');
  });
});
