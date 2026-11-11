import { describe, expect, it } from 'vitest';

import type {
  PaymentObligation,
  ObligationAllocation,
} from './obligation.types.js';

import { readObligations } from './read-obligations.js';

function obligation(
  changes: Partial<PaymentObligation> = {},
): PaymentObligation {
  return {
    key: 'interest:2026-11-25',
    component: 'INTEREST',

    dueOn: '2026-11-25',
    amount: '2000.00',

    periodFromOn: '2026-11-10',
    periodToOnExclusive: '2026-11-25',

    ...changes,
  };
}

function allocation(
  changes: Partial<ObligationAllocation> = {},
): ObligationAllocation {
  return {
    id: 'allocation-1',
    paymentId: 'receipt-1',

    obligationKey: 'interest:2026-11-25',

    effectiveOn: '2026-11-20',
    orderNo: 1,
    amount: '1500.00',

    ...changes,
  };
}

describe('Состояние обязательств', () => {
  it('учитывает раннюю оплату за первый период', () => {
    const result = readObligations(
      [obligation()],
      [allocation()],
      '2026-11-21',
    );

    expect(result.obligations[0]).toMatchObject({
      paidAmount: '1500.00',
      remainingAmount: '500.00',
      status: 'UPCOMING',
      daysPastDue: 0,
    });

    expect(result.dueNow).toBe('0.00');
    expect(result.nextPaymentOn).toBe('2026-11-25');
    expect(result.nextPaymentAmount).toBe('500.00');
  });

  it('отделяет день оплаты от просрочки', () => {
    const result = readObligations(
      [obligation()],
      [allocation()],
      '2026-11-25',
    );

    expect(result.obligations[0].status).toBe('DUE_TODAY');
    expect(result.dueNow).toBe('500.00');
    expect(result.overdueTotal).toBe('0.00');
  });

  it('показывает частичный остаток и три дня просрочки', () => {
    const result = readObligations(
      [obligation()],
      [allocation()],
      '2026-11-28',
    );

    expect(result.obligations[0]).toMatchObject({
      remainingAmount: '500.00',
      status: 'OVERDUE',
      daysPastDue: 3,
    });

    expect(result.overdueTotal).toBe('500.00');
    expect(result.daysPastDue).toBe(3);
  });

  it('суммирует несколько оплат до срока', () => {
    const result = readObligations(
      [obligation()],
      [
        allocation(),
        allocation({
          id: 'allocation-2',
          paymentId: 'receipt-2',
          effectiveOn: '2026-11-24',
          amount: '500.00',
        }),
      ],
      '2026-11-25',
    );

    expect(result.obligations[0].status).toBe('SETTLED');
    expect(result.overdueTotal).toBe('0.00');
    expect(result.nextPaymentOn).toBeNull();
  });

  it('восстанавливает прошлое до поздней доплаты', () => {
    const rows = [
      allocation(),
      allocation({
        id: 'allocation-2',
        paymentId: 'receipt-2',
        effectiveOn: '2026-11-28',
        amount: '500.00',
      }),
    ];

    expect(
      readObligations([obligation()], rows, '2026-11-27').overdueTotal,
    ).toBe('500.00');

    expect(
      readObligations([obligation()], rows, '2026-11-28').overdueTotal,
    ).toBe('0.00');
  });

  it('отражает распределение платежа сначала в пени', () => {
    const obligations = [
      obligation({ amount: '30000.00' }),

      obligation({
        key: 'penalty',
        component: 'PENALTY',
        amount: '1000.00',
        dueOn: '2026-11-26',
        periodFromOn: null,
        periodToOnExclusive: null,
      }),
    ];

    // Одно поступление 26000 ₽ разделено на две части.
    const rows = [
      allocation({
        id: 'allocation-penalty',
        obligationKey: 'penalty',
        effectiveOn: '2026-11-28',
        amount: '1000.00',
      }),

      allocation({
        id: 'allocation-interest',
        effectiveOn: '2026-11-28',
        amount: '25000.00',
        orderNo: 2,
      }),
    ];

    const result = readObligations(obligations, rows, '2026-11-28');

    expect(result.overdueTotal).toBe('5000.00');

    expect(
      result.obligations.find((item) => item.component === 'INTEREST')
        ?.remainingAmount,
    ).toBe('5000.00');
  });

  it('не учитывает будущее распределение', () => {
    const result = readObligations(
      [obligation()],
      [
        allocation({
          effectiveOn: '2026-12-01',
          amount: '2000.00',
        }),
      ],
      '2026-11-21',
    );

    expect(result.obligations[0].paidAmount).toBe('0.00');
    expect(result.nextPaymentAmount).toBe('2000.00');
  });

  it('не прибавляет будущий план к сумме к оплате сейчас', () => {
    const future = obligation({
      key: 'interest:2026-12-25',
      amount: '4000.00',
      dueOn: '2026-12-25',
      periodFromOn: '2026-11-25',
      periodToOnExclusive: '2026-12-25',
    });

    const result = readObligations(
      [obligation(), future],
      [allocation()],
      '2026-11-28',
    );

    expect(result.dueNow).toBe('500.00');
    expect(result.nextPaymentOn).toBe('2026-12-25');
    expect(result.nextPaymentAmount).toBe('4000.00');
  });

  it('объединяет компоненты ближайшего платежа', () => {
    const interest = obligation({
      key: 'interest:2026-12-25',
      amount: '4000.00',
      dueOn: '2026-12-25',
    });

    const principal = obligation({
      key: 'principal',
      component: 'PRINCIPAL',
      amount: '100000.00',
      dueOn: '2026-12-25',
      periodFromOn: null,
      periodToOnExclusive: null,
    });

    const result = readObligations([interest, principal], [], '2026-12-01');

    expect(result.nextPaymentAmount).toBe('104000.00');
    expect(result.dueNow).toBe('0.00');
  });

  it('закрывает нулевое обязательство без платежа', () => {
    const result = readObligations(
      [obligation({ amount: '0.00' })],
      [],
      '2026-11-21',
    );

    expect(result.obligations[0].status).toBe('SETTLED');
    expect(result.nextPaymentAmount).toBeNull();
  });

  it('запрещает погашение больше суммы обязательства', () => {
    expect(() =>
      readObligations(
        [obligation()],
        [allocation({ amount: '2000.01' })],
        '2026-11-25',
      ),
    ).toThrow('превышает');
  });

  it('запрещает повторное распределение', () => {
    expect(() =>
      readObligations(
        [obligation()],
        [allocation(), allocation()],
        '2026-11-25',
      ),
    ).toThrow('Повторное распределение');
  });

  it('запрещает ссылку на неизвестное обязательство', () => {
    expect(() =>
      readObligations(
        [obligation()],
        [allocation({ obligationKey: 'unknown' })],
        '2026-11-25',
      ),
    ).toThrow('Неизвестное обязательство');
  });

  it('проверяет порядок частей одного платежа', () => {
    expect(() =>
      readObligations(
        [obligation()],
        [
          allocation(),
          allocation({
            id: 'allocation-2',
            amount: '1.00',
          }),
        ],
        '2026-11-25',
      ),
    ).toThrow('Повторный порядок');
  });

  it('не изменяет входную историю', () => {
    const obligations = [obligation()];
    const rows = [allocation()];

    const original = structuredClone({
      obligations,
      rows,
    });

    readObligations(obligations, rows, '2026-11-28');

    expect({ obligations, rows }).toEqual(original);
  });

  it('возвращает нулевую сводку для пустого реестра', () => {
    expect(readObligations([], [], '2026-11-28')).toMatchObject({
      dueNow: '0.00',
      overdueTotal: '0.00',
      daysPastDue: 0,
      nextPaymentOn: null,
      nextPaymentAmount: null,
    });
  });
});
