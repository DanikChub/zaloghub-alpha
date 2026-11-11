import { describe, expect, it } from 'vitest';

import { calculateFinance } from './calculate-finance.js';

import {
  COURT_REFERENCE,
  COURT_REFERENCE_INPUT,
} from './court-reference.fixture.js';

describe('Пени в сквозном расчёте', () => {
  it('возвращает тело, проценты и пени по судебному эталону', () => {
    const result = calculateFinance(COURT_REFERENCE_INPUT);

    expect(result).toMatchObject({
      principalOutstanding: COURT_REFERENCE.expected.principal,
      interestOutstanding: COURT_REFERENCE.expected.interest,

      penaltyAccrued: COURT_REFERENCE.expected.penalty,
      penaltyOutstanding: COURT_REFERENCE.expected.penalty,

      totalOutstanding: COURT_REFERENCE.expected.totalDebt,
    });
  });

  it('отклоняет поступления, пока погашение пеней не поддерживается', () => {
    expect(() =>
      calculateFinance({
        ...COURT_REFERENCE_INPUT,

        events: [
          ...COURT_REFERENCE_INPUT.events,
          {
            id: 'receipt-1',
            kind: 'RECEIPT',
            effectiveOn: '2026-01-01',
            sequenceNo: 1,
            amount: '100.00',
          },
        ],
      }),
    ).toThrow('Пени с поступлениями');
  });

  it('не считает будущий платёж поступлением на дату расчёта', () => {
    const result = calculateFinance({
      ...COURT_REFERENCE_INPUT,

      events: [
        ...COURT_REFERENCE_INPUT.events,
        {
          id: 'future-receipt',
          kind: 'RECEIPT',
          effectiveOn: '2026-07-02',
          sequenceNo: 1,
          amount: '100.00',
        },
      ],
    });

    expect(result.totalOutstanding).toBe(COURT_REFERENCE.expected.totalDebt);

    expect(result.receivedTotal).toBe('0.00');
  });
});
