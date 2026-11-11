import { describe, expect, it } from 'vitest';
import {
  financeToday,
  normalizeDealEvents,
  suggestDealTerms,
  type FinanceDeal,
} from './deal-finance.mapper.js';

const value = (text: string) => ({ toString: () => text });
function deal(): FinanceDeal {
  return {
    id: 'deal',
    financeTerms: null,
    principalAmount: value('100000'),
    preferentialRate: value('4'),
    penaltyRate: value('0.5'),
    termMonths: 12,
    paymentDay: 25,
    moratoriumMonths: 6,
    signedAt: null,
    disbursements: [],
    payments: [],
  };
}

describe('Адаптер сделки к чистому расчёту', () => {
  it('использует московскую дату около полуночи UTC', () => {
    expect(financeToday(new Date('2026-11-06T21:30:00Z'))).toBe('2026-11-07');
  });
  it('исключает отменённые операции и стабильно упорядочивает одну дату', () => {
    const source = deal();
    const common = {
      amount: value('100'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    source.disbursements = [
      { ...common, id: 'issue', issuedAt: new Date('2026-01-10') },
    ];
    source.payments = [
      { ...common, id: 'payment', paidAt: new Date('2026-01-10') },
      {
        ...common,
        id: 'voided',
        paidAt: new Date('2026-01-10'),
        voidedAt: new Date(),
      },
    ];
    expect(
      normalizeDealEvents(source).map((e) => [e.id, e.sequenceNo]),
    ).toEqual([
      ['issue', 1],
      ['payment', 2],
    ]);
  });
  it('строит первый период после 25-го до следующего месяца и переводит проценты в доли', () => {
    const source = deal();
    source.disbursements = [
      {
        id: 'issue',
        amount: value('100000'),
        createdAt: new Date(),
        issuedAt: new Date('2026-11-28'),
      },
    ];
    const terms = suggestDealTerms(source)!;
    expect(terms.schedule.firstPaymentOn).toBe('2026-12-25');
    expect(terms.interest.rate).toBe('0.04');
    expect(terms.penalty?.dailyRate).toBe('0.005');
    expect(terms.rateLoss).toBeUndefined();
  });
});
