import { describe, expect, it } from 'vitest';
import type { LoanCalculationInput, LoanTerms } from './loan.types.js';
import type { LoanAction } from './loan-action.types.js';
import type { FinancialEvent } from '../finance.types.js';
import { calculateLoan } from './calculate-loan.js';
import { quoteSettlement } from './settlement-quote.js';
import { decimal } from '../money.js';

const terms: LoanTerms = {
  version: 1,
  contractAmount: '1000000.00',
  schedule: {
    accrualStartOn: '2026-01-10',
    firstPaymentOn: '2026-01-25',
    paymentDay: 25,
    maturityOn: '2027-01-10',
    missingPaymentDay: 'LAST_DAY_OF_MONTH',
  },
  interest: {
    kind: 'MONTHLY',
    rate: '0.04',
    accrualBase: 'OUTSTANDING_PRINCIPAL',
    dailyRateDivisor: 'FIXED_30_DAYS',
  },
  roundingMode: 'HALF_UP',
  allocation: {
    priority: 'DUE_FIRST',
    componentOrder: ['PENALTY', 'INTEREST', 'PRINCIPAL', 'EXPENSE'],
    earlyInterest: 'CURRENT_PERIOD',
    earlyPrincipal: 'BLOCKED',
    unappliedFunds: 'HOLD',
  },
  principalRepaymentFromOn: '2026-07-10',
  settlement: { minimumInterestRate: '0.04', minimumInterestMonths: 6 },
};
const issue: FinancialEvent = {
  id: 'issue',
  kind: 'DISBURSEMENT',
  effectiveOn: '2026-01-10',
  sequenceNo: 1,
  amount: '1000000.00',
};
const payment = (
  amount: string,
  date = '2026-01-20',
  id = 'payment',
): FinancialEvent => ({
  id,
  kind: 'RECEIPT',
  effectiveOn: date,
  sequenceNo: 2,
  amount,
});
const action = (values: Omit<LoanAction, 'sequenceNo'>): LoanAction =>
  ({ ...values, sequenceNo: 1 }) as LoanAction;
const refund: LoanAction = {
  id: 'refund',
  kind: 'REFUND_REQUEST',
  receiptId: 'payment',
  amount: '7350.00',
  effectiveOn: '2026-01-21',
  sequenceNo: 1,
};
const credit: LoanAction = {
  id: 'credit',
  kind: 'CREDIT',
  receiptId: 'payment',
  targets: [{ obligationKey: 'interest:2026-02-25', amount: '7350.00' }],
  effectiveOn: '2026-01-21',
  sequenceNo: 1,
};
const input = (
  changes: Partial<LoanCalculationInput> = {},
): LoanCalculationInput => ({
  loanId: 'loan',
  currency: 'RUB',
  asOfOn: '2026-01-28',
  terms,
  events: [issue, payment('27350.00')],
  ...changes,
});

describe('Переплата и возврат', () => {
  it('в день срока не направляет переплату на следующий начавшийся период', () => {
    const r = calculateLoan(
      input({ events: [issue, payment('27350.00', '2026-01-25')] }),
    );
    expect(r.availableCredit).toBe('7350.00');
    expect(
      r.allocations.some((a) => a.obligationKey === 'interest:2026-02-25'),
    ).toBe(false);
  });
  it('закрывает первый период и хранит неровную переплату отдельно', () => {
    const r = calculateLoan(input());
    expect(r.principalOutstanding).toBe('1000000.00');
    expect(r.availableCredit).toBe('7350.00');
    expect(
      r.snapshot.obligations.find((o) => o.key === 'interest:2026-01-25')
        ?.remainingAmount,
    ).toBe('0.00');
  });
  it('запрос возврата резервирует остаток, не списывая деньги', () => {
    const r = calculateLoan(input({ actions: [refund] }));
    expect(r.unappliedCredit).toBe('7350.00');
    expect(r.availableCredit).toBe('0.00');
    expect(r.refundedTotal).toBe('0.00');
    expect(r.reservedCredit).toBe('7350.00');
  });
  it('списывает только подтверждённый фактический возврат', () => {
    const r = calculateLoan(
      input({
        actions: [
          refund,
          {
            id: 'confirmed',
            kind: 'REFUND',
            instructionId: 'refund',
            effectiveOn: '2026-01-22',
            sequenceNo: 2,
          },
        ],
      }),
    );
    expect(r.refundedTotal).toBe('7350.00');
    expect(r.unappliedCredit).toBe('0.00');
    expect(r.receivedTotal).toBe('27350.00');
    expect(r.payments[0].unallocatedAmount).toBe('0.00');
  });
  it('отмена запроса освобождает резерв', () => {
    const r = calculateLoan(
      input({
        actions: [
          refund,
          {
            id: 'cancelled',
            kind: 'CANCEL_REFUND',
            instructionId: 'refund',
            effectiveOn: '2026-01-22',
            sequenceNo: 2,
          },
        ],
      }),
    );
    expect(r.availableCredit).toBe('7350.00');
  });
  it('повторный запрос после отмены не удваивает защищённую сумму', () => {
    const r = calculateLoan(
      input({
        actions: [
          refund,
          {
            id: 'cancelled',
            kind: 'CANCEL_REFUND',
            instructionId: 'refund',
            effectiveOn: '2026-01-22',
            sequenceNo: 2,
          },
          { ...refund, id: 'retry', effectiveOn: '2026-01-23', sequenceNo: 3 },
        ],
      }),
    );
    expect(r.reservedCredit).toBe('7350.00');
    expect(
      r.snapshot.obligations.find((o) => o.key === 'interest:2026-01-25')
        ?.paidAmount,
    ).toBe('20000.00');
  });
  it('не допускает двойного подтверждения в истории', () => {
    expect(() =>
      calculateLoan(
        input({
          actions: [
            refund,
            {
              id: 'a',
              kind: 'REFUND',
              instructionId: 'refund',
              effectiveOn: '2026-01-22',
              sequenceNo: 2,
            },
            {
              id: 'b',
              kind: 'REFUND',
              instructionId: 'refund',
              effectiveOn: '2026-01-23',
              sequenceNo: 3,
            },
          ],
        }),
      ),
    ).toThrow();
  });
  it('пока нет согласования, не погашает тело даже крупным переводом', () => {
    const r = calculateLoan(input({ events: [issue, payment('1240000.00')] }));
    expect(r.principalOutstanding).toBe('1000000.00');
    expect(r.availableCredit).toBe('1220000.00');
  });
});

describe('Согласованный зачёт будущих процентов', () => {
  it('до начала периода хранит целевой резерв', () => {
    const r = calculateLoan(input({ asOfOn: '2026-01-24', actions: [credit] }));
    expect(r.reservedCredit).toBe('7350.00');
    expect(r.availableCredit).toBe('0.00');
    expect(
      r.allocations.some((a) => a.obligationKey === 'interest:2026-02-25'),
    ).toBe(false);
  });
  it('при начале периода применяет именно согласованную сумму исходного поступления', () => {
    const r = calculateLoan(input({ actions: [credit] }));
    expect(r.reservedCredit).toBe('0.00');
    expect(
      r.allocations.find((a) => a.obligationKey === 'interest:2026-02-25'),
    ).toMatchObject({
      paymentId: 'payment',
      amount: '7350.00',
      effectiveOn: '2026-01-25',
    });
    expect(r.receivedTotal).toBe('27350.00');
  });
  it('может отменить ещё не применённый зачёт', () => {
    const r = calculateLoan(
      input({
        actions: [
          credit,
          {
            id: 'cancel',
            kind: 'CANCEL_CREDIT',
            instructionId: 'credit',
            effectiveOn: '2026-01-22',
            sequenceNo: 2,
          },
        ],
      }),
    );
    expect(r.availableCredit).toBe('7350.00');
  });
  it('не отменяет уже применённый зачёт', () => {
    expect(() =>
      calculateLoan(
        input({
          actions: [
            credit,
            {
              id: 'cancel',
              kind: 'CANCEL_CREDIT',
              instructionId: 'credit',
              effectiveOn: '2026-01-26',
              sequenceNo: 2,
            },
          ],
        }),
      ),
    ).toThrow('ещё не применённый');
  });
});

describe('Согласованное закрытие', () => {
  it('закрытие на конец дня сохраняет резерв возврата именно исходного поступления', () => {
    const r = calculateLoan(
      input({
        events: [
          issue,
          payment('27350.00'),
          payment('1220000.00', '2026-01-25', 'closing-cash'),
        ],
        actions: [
          {
            id: 'settlement',
            kind: 'SETTLEMENT',
            effectiveOn: '2026-01-25',
            sequenceNo: 1,
          },
          { ...refund, effectiveOn: '2026-01-25', sequenceNo: 2 },
        ],
      }),
    );
    expect(r.settledOn).toBe('2026-01-25');
    expect(
      r.credits.find((c) => c.receiptId === 'payment')?.reservedForRefund,
    ).toBe('7350.00');
    expect(r.unappliedCredit).toBe('7350.00');
    expect(r.availableCredit).toBe('0.00');
  });
  it('48% годовых: тело плюс 24% за шесть месяцев', () => {
    const r = calculateLoan(input({ events: [issue], asOfOn: '2026-01-20' }));
    expect(quoteSettlement(terms, r)).toMatchObject({
      minimumInterestTotal: '240000.00',
      amountToClose: '1240000.00',
      additionalPaymentRequired: '1240000.00',
    });
  });
  it('80 тысяч оплаченных процентов уменьшают сумму закрытия до 1.16 млн', () => {
    const t: LoanTerms = {
      ...terms,
      schedule: {
        ...terms.schedule,
        accrualStartOn: '2026-03-26',
        firstPaymentOn: '2026-04-25',
        paymentDay: 25,
      },
      principalRepaymentFromOn: '2026-09-26',
    };
    const r = calculateLoan(
      input({
        terms: t,
        asOfOn: '2026-05-26',
        events: [
          { ...issue, effectiveOn: '2026-03-26' },
          payment('40000.00', '2026-04-25', 'first'),
          payment('40000.00', '2026-05-25', 'second'),
        ],
      }),
    );
    expect(quoteSettlement(t, r).amountToClose).toBe('1160000.00');
  });
  it('закрывает тело только явным действием и прекращает начисления', () => {
    const r = calculateLoan(
      input({
        events: [issue, payment('1240000.00')],
        actions: [
          {
            id: 'settlement',
            kind: 'SETTLEMENT',
            effectiveOn: '2026-01-20',
            sequenceNo: 1,
          },
        ],
        asOfOn: '2026-03-01',
      }),
    );
    expect(r.settledOn).toBe('2026-01-20');
    expect(r.principalOutstanding).toBe('0.00');
    expect(r.interestAccrued).toBe('240000.00');
    expect(r.interestPaid).toBe('240000.00');
    expect(r.unappliedCredit).toBe('0.00');
    expect(r.snapshot.nextPaymentOn).toBeNull();
  });
  it('при недостатке денег не выполняет закрытие', () => {
    expect(() =>
      calculateLoan(
        input({
          events: [issue, payment('1239999.99')],
          actions: [
            {
              id: 'settlement',
              kind: 'SETTLEMENT',
              effectiveOn: '2026-01-20',
              sequenceNo: 1,
            },
          ],
        }),
      ),
    ).toThrow('Недостаточно');
  });
  it('HALF_EVEN не оставляет копейку долга при нормализации минимальных процентов', () => {
    const t: LoanTerms = {
      ...terms,
      contractAmount: '30.00',
      roundingMode: 'HALF_EVEN',
      interest: { ...terms.interest, rate: '0.005' },
      settlement: {
        minimumInterestRate: '0.0003333333',
        minimumInterestMonths: 1,
      },
    };
    const r = calculateLoan(
      input({
        terms: t,
        asOfOn: '2026-01-10',
        events: [{ ...issue, amount: '30.00' }, payment('30.01', '2026-01-10')],
        actions: [
          {
            id: 'settlement',
            kind: 'SETTLEMENT',
            effectiveOn: '2026-01-10',
            sequenceNo: 1,
          },
        ],
      }),
    );
    expect(r.interestAccrued).toBe('0.01');
    expect(r.totalOutstanding).toBe('0.00');
    expect(r.unappliedCredit).toBe('0.00');
  });
  it('защищает уже подтверждённый возврат при ретроактивной потере льготы', () => {
    const days: string[] = [];
    for (
      let d = new Date('2026-01-01');
      d <= new Date('2026-02-28');
      d.setUTCDate(d.getUTCDate() + 1)
    )
      if (![0, 6].includes(d.getUTCDay()))
        days.push(d.toISOString().slice(0, 10));
    const r = calculateLoan(
      input({
        terms: {
          ...terms,
          contractAmount: '1500000.00',
          rateLoss: {
            standardRate: '0.07',
            graceWorkingDays: 5,
            partialPaymentTriggers: true,
            retrospective: 'DUE_MONTH',
            calendar: {
              fromOn: '2026-01-01',
              toOn: '2026-02-28',
              workingDays: days,
            },
          },
        },
        events: [
          issue,
          payment('27350.00'),
          {
            ...issue,
            id: 'tranche',
            effectiveOn: '2026-01-23',
            amount: '500000.00',
          },
        ],
        actions: [
          refund,
          {
            id: 'returned',
            kind: 'REFUND',
            instructionId: 'refund',
            effectiveOn: '2026-01-22',
            sequenceNo: 2,
          },
        ],
      }),
    );
    expect(r.rateLossEffectiveOn).toBe('2026-01-01');
    expect(r.refundedTotal).toBe('7350.00');
    expect(r.interestPaid).toBe('20000.00');
  });
  it('сохраняет денежный баланс после возврата и зачёта', () => {
    const r = calculateLoan(
      input({
        events: [issue, payment('30000.00')],
        actions: [
          refund,
          {
            ...credit,
            targets: [
              { obligationKey: 'interest:2026-02-25', amount: '2650.00' },
            ],
            sequenceNo: 2,
          },
          {
            id: 'returned',
            kind: 'REFUND',
            instructionId: 'refund',
            effectiveOn: '2026-01-22',
            sequenceNo: 3,
          },
        ],
      }),
    );
    const applied = r.allocations.reduce(
      (sum, a) => sum.plus(a.amount),
      decimal('0'),
    );
    expect(
      applied.plus(r.unappliedCredit).plus(r.refundedTotal).toFixed(2),
    ).toBe(r.receivedTotal);
  });
});
