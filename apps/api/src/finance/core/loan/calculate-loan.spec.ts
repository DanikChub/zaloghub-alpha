import { describe, expect, it } from 'vitest';
import type { FinancialEvent } from '../finance.types.js';
import type { LoanCalculationInput, LoanTerms } from './loan.types.js';
import { calculateLoan } from './calculate-loan.js';
import { decimal } from '../money.js';
import { COURT_REFERENCE } from '../court-reference.fixture.js';

const terms: LoanTerms = {
  version: 1,
  contractAmount: '1500000.00',
  schedule: {
    accrualStartOn: '2026-11-10',
    firstPaymentOn: '2026-11-25',
    paymentDay: 25,
    maturityOn: '2027-11-10',
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
  penalty: {
    dailyRate: '0.005',
    base: 'CONTRACT_AMOUNT',
    paymentDay: 'INCLUDED',
  },
};
const issue: FinancialEvent = {
  id: 'issue',
  kind: 'DISBURSEMENT',
  effectiveOn: '2026-11-10',
  sequenceNo: 1,
  amount: '1500000.00',
};
const receipt = (
  id: string,
  date: string,
  amount: string,
  sequenceNo = 1,
): FinancialEvent => ({
  id,
  kind: 'RECEIPT',
  effectiveOn: date,
  sequenceNo,
  amount,
});
const input = (
  changes: Partial<LoanCalculationInput> = {},
): LoanCalculationInput => ({
  loanId: 'loan',
  currency: 'RUB',
  asOfOn: '2026-11-28',
  terms,
  events: [issue],
  ...changes,
});

describe('Хронология займа', () => {
  it('не начисляет пени в день срока', () => {
    const result = calculateLoan(input({ asOfOn: '2026-11-25' }));
    expect(result.penaltyAccrued).toBe('0.00');
    expect(result.snapshot.dueNow).toBe('30000.00');
  });
  it('считает три дня пени при недоплате 4000 от договорной базы', () => {
    const result = calculateLoan(
      input({ events: [issue, receipt('partial', '2026-11-25', '26000.00')] }),
    );
    expect(result.penaltyAccrued).toBe('22500.00');
    expect(
      result.snapshot.obligations.find((o) => o.key === 'interest:2026-11-25')
        ?.remainingAmount,
    ).toBe('4000.00');
    expect(result.snapshot.daysPastDue).toBe(3);
  });
  it('поддерживает другую базу: пени только от недоплаты', () => {
    const result = calculateLoan(
      input({
        terms: {
          ...terms,
          penalty: { ...terms.penalty!, base: 'OVERDUE_BALANCE' },
        },
        events: [issue, receipt('partial', '2026-11-25', '26000.00')],
      }),
    );
    expect(result.penaltyAccrued).toBe('60.00');
  });
  it('уменьшает базу после частичной оплаты, сначала погашая пени', () => {
    const result = calculateLoan(
      input({
        terms: {
          ...terms,
          penalty: { ...terms.penalty!, base: 'OVERDUE_BALANCE' },
        },
        events: [
          issue,
          receipt('partial', '2026-11-25', '26000.00'),
          receipt('more', '2026-11-27', '1000.00'),
        ],
      }),
    );
    expect(result.penaltyAccrued).toBe('55.20');
    expect(result.penaltyPaid).toBe('40.00');
    expect(
      result.snapshot.obligations.find((o) => o.key === 'interest:2026-11-25')
        ?.remainingAmount,
    ).toBe('3040.00');
  });
  it('прекращает новые пени после погашения просроченных процентов', () => {
    const result = calculateLoan(
      input({
        asOfOn: '2026-11-30',
        events: [issue, receipt('late', '2026-11-28', '52500.00')],
      }),
    );
    expect(result.penaltyAccrued).toBe('22500.00');
    expect(result.penaltyOutstanding).toBe('0.00');
    expect(result.snapshot.overdueTotal).toBe('0.00');
  });
  it('может исключать день оплаты из пени', () => {
    const result = calculateLoan(
      input({
        terms: {
          ...terms,
          penalty: { ...terms.penalty!, paymentDay: 'EXCLUDED' },
        },
        events: [issue, receipt('late', '2026-11-28', '45000.00')],
      }),
    );
    expect(result.penaltyAccrued).toBe('15000.00');
    expect(result.snapshot.overdueTotal).toBe('0.00');
  });
  it('ранняя оплата закрывает первое обязательство, а не будущий месяц', () => {
    const result = calculateLoan(
      input({
        asOfOn: '2026-11-21',
        events: [issue, receipt('early', '2026-11-20', '30000.00')],
      }),
    );
    expect(result.snapshot.nextPaymentOn).toBe('2026-12-25');
    expect(result.snapshot.nextPaymentAmount).toBe('60000.00');
    expect(result.prepaidInterest).toBe('6000.00');
    expect(result.interestOutstanding).toBe('0.00');
  });
  it('не включает будущие проценты в фактический долг', () => {
    const result = calculateLoan(input({ asOfOn: '2026-11-10' }));
    expect(result.interestAccrued).toBe('2000.00');
    expect(result.totalOutstanding).toBe('1502000.00');
    expect(result.snapshot.nextPaymentAmount).toBe('30000.00');
  });
  it('не считает будущие операции и не выдумывает выданное тело', () => {
    const result = calculateLoan(input({ asOfOn: '2026-11-09' }));
    expect(result.principalOutstanding).toBe('0.00');
    expect(result.interestAccrued).toBe('0.00');
    expect(result.receivedTotal).toBe('0.00');
  });
  it('пересчитывает всю историю независимо от порядка входных операций', () => {
    const events = [
      issue,
      receipt('early', '2026-11-20', '26000.00'),
      receipt('late', '2026-11-28', '26500.00'),
    ];
    expect(calculateLoan(input({ events: [...events].reverse() }))).toEqual(
      calculateLoan(input({ events })),
    );
  });
  it('не меняет вход и даёт тот же результат при повторении', () => {
    const source = input({
      events: [issue, receipt('early', '2026-11-20', '26000.00')],
    });
    const original = structuredClone(source);
    expect(calculateLoan(source)).toEqual(calculateLoan(source));
    expect(source).toEqual(original);
  });
  it('мораторий блокирует досрочное тело, но не мешает возврату в срок', () => {
    const result = calculateLoan(
      input({
        asOfOn: '2026-11-20',
        terms: {
          ...terms,
          allocation: { ...terms.allocation, earlyPrincipal: 'ALLOWED' },
          principalRepaymentFromOn: '2027-05-10',
        },
        events: [issue, receipt('early', '2026-11-20', '50000.00')],
      }),
    );
    expect(result.principalReturned).toBe('0.00');
    expect(result.unappliedCredit).toBe('20000.00');
  });
  it('досрочное тело уменьшает будущую базу, высвобождая переплату процентов', () => {
    const result = calculateLoan(
      input({
        asOfOn: '2026-11-21',
        terms: {
          ...terms,
          allocation: { ...terms.allocation, earlyPrincipal: 'ALLOWED' },
        },
        events: [issue, receipt('close', '2026-11-20', '1530000.00')],
      }),
    );
    expect(result.principalOutstanding).toBe('0.00');
    expect(result.interestAccrued).toBe('20000.00');
    expect(result.unappliedCredit).toBe('10000.00');
    expect(result.snapshot.nextPaymentOn).toBeNull();
  });
  it('после срока продолжает начислять проценты на непогашенное тело', () => {
    const result = calculateLoan(
      input({
        terms: {
          ...terms,
          schedule: { ...terms.schedule, maturityOn: '2026-11-25' },
        },
      }),
    );
    expect(result.interestAccrued).toBe('38000.00');
    expect(
      result.snapshot.obligations.find((o) => o.key === 'principal')?.status,
    ).toBe('OVERDUE');
  });
  it('ретроактивно повышает пени после порога', () => {
    const result = calculateLoan(
      input({
        asOfOn: '2026-12-25',
        terms: {
          ...terms,
          penalty: {
            ...terms.penalty!,
            increase: {
              afterMonths: 1,
              dailyRate: '0.015',
              retrospective: true,
            },
          },
        },
      }),
    );
    expect(result.penaltyAccrued).toBe('675000.00');
    expect(result.accruals.find((a) => a.component === 'PENALTY')?.rate).toBe(
      '0.015',
    );
  });
  it('не повышает пени после уже закрытой просрочки', () => {
    const result = calculateLoan(
      input({
        asOfOn: '2026-12-24',
        terms: {
          ...terms,
          penalty: {
            ...terms.penalty!,
            increase: {
              afterMonths: 1,
              dailyRate: '0.015',
              retrospective: true,
            },
          },
        },
        events: [issue, receipt('cure', '2026-11-28', '52500.00')],
      }),
    );
    expect(result.penaltyAccrued).toBe('22500.00');
  });
  it('сохраняет деньги: распределения плюс остаток равны поступлениям', () => {
    const result = calculateLoan(
      input({
        events: [
          issue,
          receipt('a', '2026-11-20', '50000.01'),
          receipt('b', '2026-11-28', '100.00'),
        ],
      }),
    );
    const paid = result.allocations.reduce(
      (sum, row) => sum.plus(row.amount),
      decimal('0'),
    );
    expect(paid.plus(result.unappliedCredit).toFixed(2)).toBe(
      result.receivedTotal,
    );
  });
  it('отклоняет выдачи сверх договорной суммы', () => {
    expect(() =>
      calculateLoan(input({ events: [{ ...issue, amount: '1500000.01' }] })),
    ).toThrow('превышают');
  });
  it('отклоняет повтор поступления', () => {
    const payment = receipt('same', '2026-11-20', '100.00');
    expect(() =>
      calculateLoan(input({ events: [issue, payment, payment] })),
    ).toThrow();
  });
  it('сохраняет денежные инварианты на смешанной истории частичных и досрочных оплат', () => {
    let seed = 431;
    const random = () => {
      seed = (seed * 48271) % 2147483647;
      return seed;
    };
    for (let example = 0; example < 12; example += 1) {
      const events: FinancialEvent[] = [issue];
      for (let i = 0; i < 12; i += 1)
        events.push(
          receipt(
            `payment-${i}`,
            `2026-11-${String(10 + (random() % 21)).padStart(2, '0')}`,
            `${1 + (random() % 200000)}.00`,
            i + 2,
          ),
        );
      const result = calculateLoan(
        input({
          asOfOn: '2026-12-28',
          events,
          terms: {
            ...terms,
            allocation: { ...terms.allocation, earlyPrincipal: 'ALLOWED' },
            penalty: { ...terms.penalty!, base: 'OVERDUE_BALANCE' },
          },
        }),
      );
      const sum = (values: readonly string[]) =>
        values.reduce((total, value) => total.plus(value), decimal('0'));
      expect(
        sum(result.allocations.map((a) => a.amount))
          .plus(result.unappliedCredit)
          .toFixed(2),
      ).toBe(result.receivedTotal);
      expect(
        sum(
          result.accruals
            .filter((a) => a.component === 'INTEREST')
            .map((a) => a.amount),
        ).toFixed(2),
      ).toBe(result.interestAccrued);
      expect(
        sum(
          result.accruals
            .filter((a) => a.component === 'PENALTY')
            .map((a) => a.amount),
        ).toFixed(2),
      ).toBe(result.penaltyAccrued);
      for (const row of result.snapshot.obligations)
        expect(decimal(row.remainingAmount).greaterThanOrEqualTo(0)).toBe(true);
      for (const payment of result.payments)
        expect(
          decimal(payment.allocatedAmount).lessThanOrEqualTo(payment.amount),
        ).toBe(true);
    }
  });
  it('отклоняет опечатку в названии договорного правила', () => {
    expect(() =>
      calculateLoan(input({ terms: { ...terms, rateLose: {} } as LoanTerms })),
    ).toThrow('неизвестное поле');
  });
});

describe('Утрата льготы', () => {
  const loss: NonNullable<LoanTerms['rateLoss']> = {
    standardRate: '0.07',
    graceWorkingDays: 5,
    partialPaymentTriggers: false,
    retrospective: 'DUE_MONTH',
    calendar: {
      fromOn: '2026-11-01',
      toOn: '2026-12-31',
      workingDays: [
        '2026-11-26',
        '2026-11-27',
        '2026-11-30',
        '2026-12-01',
        '2026-12-02',
        '2026-12-03',
      ],
    },
  };
  it('сохраняет льготу в течение пяти рабочих дней', () => {
    const result = calculateLoan(
      input({ asOfOn: '2026-12-02', terms: { ...terms, rateLoss: loss } }),
    );
    expect(result.rateLossEffectiveOn).toBeNull();
  });
  it('на шестой рабочий день пересчитывает с месяца нарушения', () => {
    const result = calculateLoan(
      input({ asOfOn: '2026-12-03', terms: { ...terms, rateLoss: loss } }),
    );
    expect(result.rateLossEffectiveOn).toBe('2026-11-01');
    expect(
      result.snapshot.obligations.find((o) => o.key === 'interest:2026-11-25')
        ?.amount,
    ).toBe('52500.00');
  });
  it('может прекращать льготу из-за частичной оплаты без ожидания пяти дней', () => {
    const result = calculateLoan(
      input({
        terms: {
          ...terms,
          rateLoss: { ...loss, partialPaymentTriggers: true },
        },
        events: [issue, receipt('partial', '2026-11-25', '26000.00')],
      }),
    );
    expect(result.rateLossEffectiveOn).toBe('2026-11-01');
  });
  it('отказывается считать по неполному рабочему календарю', () => {
    expect(() =>
      calculateLoan(
        input({
          terms: {
            ...terms,
            rateLoss: {
              ...loss,
              calendar: { ...loss.calendar, toOn: '2026-11-27' },
            },
          },
        }),
      ),
    ).toThrow('не покрывает');
  });
});

it('новая хронология воспроизводит судебный эталон без поступлений', () => {
  const c = COURT_REFERENCE;
  const result = calculateLoan(
    input({
      asOfOn: c.calculation.asOfOn,
      terms: {
        ...terms,
        contractAmount: c.contract.principal,
        schedule: {
          ...terms.schedule,
          accrualStartOn: c.calculation.interestFromOn,
          firstPaymentOn: '2025-12-25',
          maturityOn: '2028-11-07',
        },
        interest: { ...terms.interest, rate: c.contract.standardMonthlyRate },
        penalty: {
          ...terms.penalty!,
          increase: { afterMonths: 3, dailyRate: '0.015', retrospective: true },
        },
      },
      events: [
        {
          ...issue,
          effectiveOn: c.calculation.interestFromOn,
          amount: c.contract.principal,
        },
      ],
    }),
  );
  expect(result.interestAccrued).toBe(c.expected.interest);
  expect(result.penaltyAccrued).toBe(c.expected.penalty);
  expect(result.totalOutstanding).toBe(c.expected.totalDebt);
});
