import { describe, expect, it } from 'vitest';

import {
  COURT_REFERENCE,
  COURT_REFERENCE_INPUT,
} from './court-reference.fixture.js';

import { calculateFinance } from './calculate-finance.js';
import { daysBetween, nextDay } from './dates.js';
import { decimal, formatMoney } from './money.js';

describe('Судебный эталон: договор №1 на 01.07.2026', () => {
  it('определяет длительность периодов с обеими границами', () => {
    const endExclusive = nextDay(COURT_REFERENCE.calculation.asOfOn);

    expect(
      daysBetween(COURT_REFERENCE.calculation.interestFromOn, endExclusive),
    ).toBe(COURT_REFERENCE.calculation.interestDays);

    expect(
      daysBetween(COURT_REFERENCE.calculation.penaltyFromOn, endExclusive),
    ).toBe(COURT_REFERENCE.calculation.penaltyDays);
  });

  it('сохраняет основной долг при отсутствии поступлений', () => {
    const result = calculateFinance(COURT_REFERENCE_INPUT);

    expect(result.principalOutstanding).toBe(
      COURT_REFERENCE.expected.principal,
    );

    expect(result.receivedTotal).toBe(COURT_REFERENCE.expected.receivedTotal);

    expect(result.unappliedCredit).toBe('0.00');
  });

  it('воспроизводит проценты из судебного расчёта', () => {
    const result = calculateFinance(COURT_REFERENCE_INPUT);

    expect(result.interestAccrued).toBe(COURT_REFERENCE.expected.interest);

    expect(result.interestOutstanding).toBe(COURT_REFERENCE.expected.interest);
  });

  it('воспроизводит контрольную арифметику пеней из решения', () => {
    const penaltyDays = daysBetween(
      COURT_REFERENCE.calculation.penaltyFromOn,
      nextDay(COURT_REFERENCE.calculation.asOfOn),
    );

    const penalty = decimal(COURT_REFERENCE.contract.principal)
      .times(COURT_REFERENCE.contract.increasedDailyPenaltyRate)
      .times(penaltyDays);

    expect(formatMoney(penalty, 'HALF_UP')).toBe(
      COURT_REFERENCE.expected.penalty,
    );

    // Это проверка формулы решения.
    // Расчёт пеней самим движком здесь ещё не проверяется.
  });

  it('должен возвращать полный долг по судебному эталону', () => {
    const result = calculateFinance(COURT_REFERENCE_INPUT);

    expect(
      result.totalOutstanding,
      'Полный долг должен включать тело, проценты и пени',
    ).toBe(COURT_REFERENCE.expected.totalDebt);
  });
});
