import { describe, expect, it } from 'vitest';

import type { FinanceCalculationInput } from './calculation-input.types.js';

import { calculateFinance } from './calculate-finance.js';

function createInput(): FinanceCalculationInput {
  return {
    loanId: 'loan-1',
    currency: 'RUB',
    asOfOn: '2026-11-30',

    interest: {
      kind: 'MONTHLY',
      rate: '0.04',
      accrualBase: 'OUTSTANDING_PRINCIPAL',
      dailyRateDivisor: 'CALENDAR_MONTH_DAYS',
    },

    policy: {
      interestRoundingMethod: 'CUMULATIVE_TOTAL',
      interestRoundingMode: 'HALF_UP',
      paymentAllocationOrder: 'INTEREST_THEN_PRINCIPAL',
      eventTiming: 'BEFORE_DAILY_ACCRUAL',
      principalRepayment: 'ALLOWED',
      unappliedFunds: 'HOLD',
    },

    events: [
      {
        id: 'disbursement-1',
        kind: 'DISBURSEMENT',
        effectiveOn: '2026-11-01',
        sequenceNo: 1,
        amount: '650000.00',
      },
    ],
  };
}

describe('Сквозной финансовый расчёт', () => {
  it('считает полный месяц без поступлений', () => {
    expect(calculateFinance(createInput())).toEqual({
      loanId: 'loan-1',
      currency: 'RUB',
      asOfOn: '2026-11-30',

      disbursedTotal: '650000.00',
      receivedTotal: '0.00',

      principalOutstanding: '650000.00',
      interestAccrued: '26000.00',
      interestOutstanding: '26000.00',

      unappliedCredit: '0.00',
      totalOutstanding: '676000.00',
      penaltyAccrued: '0.00',
      penaltyOutstanding: '0.00',
    });
  });

  it('возвращает нулевые значения без событий', () => {
    const result = calculateFinance({
      ...createInput(),
      events: [],
    });

    expect(result.principalOutstanding).toBe('0.00');
    expect(result.interestAccrued).toBe('0.00');
    expect(result.totalOutstanding).toBe('0.00');
  });

  it('учитывает выбранный порядок обработки дня', () => {
    const input = {
      ...createInput(),
      asOfOn: '2026-11-01',
    };

    const before = calculateFinance(input);

    const after = calculateFinance({
      ...input,
      policy: {
        ...input.policy,
        eventTiming: 'AFTER_DAILY_ACCRUAL',
      },
    });

    expect(before.interestAccrued).toBe('866.67');
    expect(after.interestAccrued).toBe('0.00');
  });

  it('погашает тело и проценты полностью', () => {
    const input = createInput();

    const result = calculateFinance({
      ...input,
      asOfOn: '2026-11-02',

      policy: {
        ...input.policy,
        eventTiming: 'AFTER_DAILY_ACCRUAL',
      },

      events: [
        ...input.events,
        {
          id: 'receipt-1',
          kind: 'RECEIPT',
          effectiveOn: '2026-11-02',
          sequenceNo: 1,
          amount: '650866.67',
        },
      ],
    });

    expect(result.principalOutstanding).toBe('0.00');
    expect(result.interestAccrued).toBe('866.67');
    expect(result.interestOutstanding).toBe('0.00');
    expect(result.unappliedCredit).toBe('0.00');
    expect(result.totalOutstanding).toBe('0.00');
  });

  it('уменьшает базу начисления после погашения тела', () => {
    const input = createInput();

    const result = calculateFinance({
      ...input,
      asOfOn: '2026-11-02',

      policy: {
        ...input.policy,
        paymentAllocationOrder: 'PRINCIPAL_THEN_INTEREST',
      },

      events: [
        ...input.events,
        {
          id: 'receipt-1',
          kind: 'RECEIPT',
          effectiveOn: '2026-11-02',
          sequenceNo: 1,
          amount: '10000.00',
        },
      ],
    });

    expect(result.principalOutstanding).toBe('640000.00');
    expect(result.interestAccrued).toBe('1720.00');
    expect(result.totalOutstanding).toBe('641720.00');
  });

  it('сохраняет остаток поступления при запрете погашать тело', () => {
    const input = createInput();

    const result = calculateFinance({
      ...input,
      asOfOn: '2026-11-02',

      policy: {
        ...input.policy,
        principalRepayment: 'BLOCKED',
      },

      events: [
        ...input.events,
        {
          id: 'receipt-1',
          kind: 'RECEIPT',
          effectiveOn: '2026-11-02',
          sequenceNo: 1,
          amount: '10000.00',
        },
      ],
    });

    expect(result.principalOutstanding).toBe('650000.00');
    expect(result.unappliedCredit).toBe('9133.33');

    // Нераспределённые деньги автоматически не расходуются.
    expect(result.interestOutstanding).toBe('866.66');
  });

  it('не учитывает будущую выдачу', () => {
    const input = createInput();

    const result = calculateFinance({
      ...input,
      events: [
        ...input.events,
        {
          id: 'future-disbursement',
          kind: 'DISBURSEMENT',
          effectiveOn: '2026-12-01',
          sequenceNo: 1,
          amount: '100000.00',
        },
      ],
    });

    expect(result.disbursedTotal).toBe('650000.00');
    expect(result.interestAccrued).toBe('26000.00');
  });

  it('не изменяет входные данные', () => {
    const input = createInput();
    const original = structuredClone(input);

    calculateFinance(input);

    expect(input).toEqual(original);
  });
});
