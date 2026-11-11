import type { FinanceCalculationInput } from './calculation-input.types.js';

import type { FinanceCalculationResult } from './calculation-result.types.js';

import type { FinancialEvent, LocalDate } from './finance.types.js';

import { decimal } from './money.js';
import { nextDay } from './dates.js';
import { validateInput } from './validate-input.js';
import { prepareEvents } from './prepare-events.js';

import { createInterestLedger, accrueInterest } from './interest-ledger.js';

import { readInterestLedger } from './read-interest-ledger.js';
import { payInterest } from './pay-interest.js';
import { calculatePeriodInterest } from './calculate-period-interest.js';
import { allocatePayment } from './allocate-payment.js';
import { calculatePenalty } from './calculate-penalty.js';

export function calculateFinance(
  input: FinanceCalculationInput,
): FinanceCalculationResult {
  validateInput(input);

  const events = prepareEvents(input.events, input.asOfOn);

  let principal = decimal('0');
  let disbursedTotal = decimal('0');
  let receivedTotal = decimal('0');
  let unappliedCredit = decimal('0');

  let interestLedger = createInterestLedger(input.policy.interestRoundingMode);

  function processEvent(event: FinancialEvent): void {
    const amount = decimal(event.amount);

    if (event.kind === 'DISBURSEMENT') {
      principal = principal.plus(amount);
      disbursedTotal = disbursedTotal.plus(amount);
      return;
    }

    receivedTotal = receivedTotal.plus(amount);

    const interest = readInterestLedger(interestLedger);

    const allocation = allocatePayment({
      amount: event.amount,

      principalToPay:
        input.policy.principalRepayment === 'ALLOWED'
          ? principal.toFixed(2)
          : '0.00',

      interestToPay: interest.outstanding,

      order: input.policy.paymentAllocationOrder,
    });

    principal = principal.minus(allocation.principalPaid);

    interestLedger = payInterest(interestLedger, allocation.interestPaid);

    unappliedCredit = unappliedCredit.plus(allocation.unallocatedAmount);
  }

  function accrueDay(day: LocalDate): void {
    if (principal.isZero()) {
      return;
    }

    const interest = calculatePeriodInterest({
      principal: principal.toFixed(2),
      fromOn: day,
      toOnExclusive: nextDay(day),
      terms: input.interest,
    });

    interestLedger = accrueInterest(interestLedger, interest);
  }

  let eventIndex = 0;

  function processDayEvents(day: LocalDate): void {
    while (
      eventIndex < events.length &&
      events[eventIndex].effectiveOn === day
    ) {
      processEvent(events[eventIndex]);
      eventIndex += 1;
    }
  }

  if (events.length > 0) {
    let day = events[0].effectiveOn;

    while (day <= input.asOfOn) {
      if (input.policy.eventTiming === 'BEFORE_DAILY_ACCRUAL') {
        processDayEvents(day);
      }

      accrueDay(day);

      if (input.policy.eventTiming === 'AFTER_DAILY_ACCRUAL') {
        processDayEvents(day);
      }

      if (day === input.asOfOn) {
        break;
      }

      day = nextDay(day);
    }
  }

  const interest = readInterestLedger(interestLedger);



  const penaltyOutstanding =
    input.penalty === undefined
      ? '0.00'
      : calculatePenalty(input.penalty, input.asOfOn);

  return {
    loanId: input.loanId,
    currency: input.currency,
    asOfOn: input.asOfOn,

    disbursedTotal: disbursedTotal.toFixed(2),
    receivedTotal: receivedTotal.toFixed(2),

    principalOutstanding: principal.toFixed(2),

    interestAccrued: interest.accruedTotal,
    interestOutstanding: interest.outstanding,

    unappliedCredit: unappliedCredit.toFixed(2),

    totalOutstanding: principal
      .plus(interest.outstanding)
      .plus(penaltyOutstanding)
      .toFixed(2),
    penaltyAccrued: penaltyOutstanding,
    penaltyOutstanding,
  };
}
