import type { FinanceCalculationInput } from './calculation-input.types.js';

export const COURT_REFERENCE = {
  contract: {
    signedOn: '2025-11-07',
    amendedOn: '2025-12-04',

    principal: '815317.31',
    termMonths: 36,
    paymentDay: 25,

    preferentialMonthlyRate: '0.04',
    standardMonthlyRate: '0.07',

    preferentialBreachWorkingDays: 5,

    initialDailyPenaltyRate: '0.005',
    increasedDailyPenaltyRate: '0.015',
    penaltyIncreaseAfterMonths: 3,

    moratoriumMonths: 6,
  },

  calculation: {
    asOfOn: '2026-07-01',

    interestFromOn: '2025-12-09',
    interestDays: 205,

    penaltyFromOn: '2025-12-26',
    penaltyDays: 188,
  },

  expected: {
    principal: '815317.31',
    receivedTotal: '0.00',
    interest: '389993.45',
    penalty: '2299194.81',

    totalDebt: '3504505.57',

    collateralValue: '2500000.00',
    remainingAfterCollateral: '1004505.57',

    courtExpenses: '160180.22',
  },
} as const;

export const COURT_REFERENCE_INPUT: FinanceCalculationInput = {
  loanId: 'contract-1-court-reference',
  currency: 'RUB',

  asOfOn: COURT_REFERENCE.calculation.asOfOn,

  interest: {
    kind: 'MONTHLY',

    // Ставка уже определена по судебному расчётному срезу.
    // Автоматическую потерю льготы движок пока не рассчитывает.
    rate: COURT_REFERENCE.contract.standardMonthlyRate,

    accrualBase: 'OUTSTANDING_PRINCIPAL',
    dailyRateDivisor: 'FIXED_30_DAYS',
  },

  penalty: {
    kind: 'FIXED_DAILY',

    baseAmount: COURT_REFERENCE.contract.principal,

    dailyRate: COURT_REFERENCE.contract.increasedDailyPenaltyRate,

    fromOn: COURT_REFERENCE.calculation.penaltyFromOn,

    toOnExclusive: null,
    roundingMode: 'HALF_UP',
  },

  policy: {
    interestRoundingMethod: 'CUMULATIVE_TOTAL',
    interestRoundingMode: 'HALF_UP',

    // Пока поступлений нет, очередность не влияет на результат.
    // Полная договорная очередь с пенями ещё не реализована.
    paymentAllocationOrder: 'INTEREST_THEN_PRINCIPAL',

    eventTiming: 'BEFORE_DAILY_ACCRUAL',
    principalRepayment: 'BLOCKED',
    unappliedFunds: 'HOLD',
  },

  events: [
    {
      // Агрегированная стартовая позиция судебного периода.
      // Это не отдельный банковский перевод.
      id: 'court-normalized-opening-principal',
      kind: 'DISBURSEMENT',

      effectiveOn: COURT_REFERENCE.calculation.interestFromOn,
      sequenceNo: 1,

      amount: COURT_REFERENCE.contract.principal,
    },

    // RECEIPT отсутствуют: заёмщик ничего не платил.
  ],
};
