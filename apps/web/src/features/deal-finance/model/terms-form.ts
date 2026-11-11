import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { Deal } from '../../../entities/deal/model/types'
import type { DebtComponent, LoanTerms } from '../../../entities/deal/model/finance.types'
import { shiftDecimal } from './helpers'

export interface TermsValues {
  amount: string
  start: Dayjs
  first: Dayjs
  maturity: Dayjs
  paymentDay: number
  rate: string
  divisor: LoanTerms['interest']['dailyRateDivisor']
  rounding: LoanTerms['roundingMode']
  missingDay: LoanTerms['schedule']['missingPaymentDay']
  order: string
  earlyInterest: LoanTerms['allocation']['earlyInterest']
  earlyPrincipal: LoanTerms['allocation']['earlyPrincipal']
  moratorium: boolean
  moratoriumEnd: Dayjs
  settlement: boolean
  minimumRate: string
  minimumMonths: number
  penalty: boolean
  penaltyRate: string
  penaltyBase: NonNullable<LoanTerms['penalty']>['base']
  paymentDayPenalty: 'INCLUDED' | 'EXCLUDED'
  increase: boolean
  increasedRate: string
  increaseMonths: number
  retrospective: boolean
  loss: boolean
  standardRate: string
  graceDays: number
  partialTriggers: boolean
}
export function nextPayment(start: Dayjs, paymentDay: number): Dayjs {
  let candidate = start.date(Math.min(paymentDay, start.daysInMonth()))
  if (!candidate.isAfter(start, 'day')) {
    const month = start.startOf('month').add(1, 'month')
    candidate = month.date(Math.min(paymentDay, month.daysInMonth()))
  }
  return candidate
}
export function fallbackTerms(deal: Deal): LoanTerms {
  const issued = deal.disbursements.map((d) => d.issuedAt.slice(0, 10)).sort()[0]
  const start = dayjs(issued ?? deal.signedAt ?? undefined)
  return {
    version: 1,
    contractAmount: deal.principalAmount,
    schedule: {
      accrualStartOn: start.format('YYYY-MM-DD'),
      firstPaymentOn: nextPayment(start, deal.paymentDay).format('YYYY-MM-DD'),
      paymentDay: deal.paymentDay,
      maturityOn: dayjs(deal.signedAt ?? start)
        .add(deal.termMonths, 'month')
        .format('YYYY-MM-DD'),
      missingPaymentDay: 'LAST_DAY_OF_MONTH',
    },
    interest: {
      kind: 'MONTHLY',
      rate: shiftDecimal(deal.preferentialRate, -2),
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
    ...(deal.moratoriumMonths > 0
      ? {
          principalRepaymentFromOn: start.add(deal.moratoriumMonths, 'month').format('YYYY-MM-DD'),
          settlement: {
            minimumInterestRate: shiftDecimal(deal.preferentialRate, -2),
            minimumInterestMonths: deal.moratoriumMonths,
          },
        }
      : {}),
    penalty: { dailyRate: shiftDecimal(deal.penaltyRate, -2), base: 'CONTRACT_AMOUNT', paymentDay: 'INCLUDED' },
  }
}
export function toValues(t: LoanTerms, deal: Deal): TermsValues {
  return {
    amount: t.contractAmount,
    start: dayjs(t.schedule.accrualStartOn),
    first: dayjs(t.schedule.firstPaymentOn),
    maturity: dayjs(t.schedule.maturityOn),
    paymentDay: t.schedule.paymentDay,
    rate: shiftDecimal(t.interest.rate, 2),
    divisor: t.interest.dailyRateDivisor,
    rounding: t.roundingMode,
    missingDay: t.schedule.missingPaymentDay,
    order: t.allocation.componentOrder.join(','),
    earlyInterest: t.allocation.earlyInterest,
    earlyPrincipal: t.allocation.earlyPrincipal,
    moratorium: !!t.principalRepaymentFromOn && t.principalRepaymentFromOn > t.schedule.accrualStartOn,
    moratoriumEnd: dayjs(t.principalRepaymentFromOn ?? t.schedule.accrualStartOn),
    settlement: !!t.settlement,
    minimumRate: shiftDecimal(t.settlement?.minimumInterestRate ?? t.interest.rate, 2),
    minimumMonths: t.settlement?.minimumInterestMonths ?? Math.max(1, deal.moratoriumMonths),
    penalty: !!t.penalty,
    penaltyRate: shiftDecimal(t.penalty?.dailyRate ?? '0', 2),
    penaltyBase: t.penalty?.base ?? 'CONTRACT_AMOUNT',
    paymentDayPenalty: t.penalty?.paymentDay ?? 'INCLUDED',
    increase: !!t.penalty?.increase,
    increasedRate: t.penalty?.increase ? shiftDecimal(t.penalty.increase.dailyRate, 2) : deal.increasedPenaltyRate,
    increaseMonths: t.penalty?.increase?.afterMonths ?? 3,
    retrospective: t.penalty?.increase?.retrospective ?? true,
    loss: !!t.rateLoss,
    standardRate: t.rateLoss ? shiftDecimal(t.rateLoss.standardRate, 2) : deal.standardRate,
    graceDays: t.rateLoss?.graceWorkingDays ?? 5,
    partialTriggers: t.rateLoss?.partialPaymentTriggers ?? true,
  }
}
export function fromValues(v: TermsValues, source: LoanTerms): LoanTerms {
  const sameStart = v.start.format('YYYY-MM-DD') === source.schedule.accrualStartOn
  return {
    version: 1,
    contractAmount: v.amount,
    schedule: {
      accrualStartOn: v.start.format('YYYY-MM-DD'),
      firstPaymentOn: v.first.format('YYYY-MM-DD'),
      maturityOn: v.maturity.format('YYYY-MM-DD'),
      paymentDay: v.paymentDay,
      missingPaymentDay: v.missingDay,
    },
    interest: {
      kind: 'MONTHLY',
      rate: shiftDecimal(v.rate, -2),
      accrualBase: 'OUTSTANDING_PRINCIPAL',
      dailyRateDivisor: v.divisor,
    },
    roundingMode: v.rounding,
    allocation: {
      priority: 'DUE_FIRST',
      componentOrder: v.order.split(',') as DebtComponent[],
      earlyInterest: v.earlyInterest,
      earlyPrincipal: v.earlyPrincipal,
      unappliedFunds: 'HOLD',
    },
    ...(v.moratorium
      ? {
          principalRepaymentFromOn: v.moratoriumEnd.format('YYYY-MM-DD'),
          ...(v.settlement
            ? {
                settlement: {
                  minimumInterestRate: shiftDecimal(v.minimumRate, -2),
                  minimumInterestMonths: v.minimumMonths,
                },
              }
            : {}),
        }
      : {}),
    ...(v.penalty
      ? {
          penalty: {
            dailyRate: shiftDecimal(v.penaltyRate, -2),
            base: v.penaltyBase,
            paymentDay: v.paymentDayPenalty,
            ...(v.increase
              ? {
                  increase: {
                    dailyRate: shiftDecimal(v.increasedRate, -2),
                    afterMonths: v.increaseMonths,
                    retrospective: v.retrospective,
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(v.loss
      ? {
          ...(sameStart && source.calendarVersionIds ? { calendarVersionIds: source.calendarVersionIds } : {}),
          rateLoss: {
            standardRate: shiftDecimal(v.standardRate, -2),
            graceWorkingDays: v.graceDays,
            partialPaymentTriggers: v.partialTriggers,
            retrospective: 'DUE_MONTH',
            ...(sameStart && source.rateLoss?.calendar ? { calendar: source.rateLoss.calendar } : {}),
          },
        }
      : {}),
  }
}
