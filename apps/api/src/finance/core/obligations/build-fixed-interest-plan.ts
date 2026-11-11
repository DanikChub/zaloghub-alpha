import type {
  FixedInterestPlanInput,
  PaymentObligation,
} from './obligation.types.js';

import { calculatePeriodInterest } from '../calculate-period-interest.js';

import { accrueInterest, createInterestLedger } from '../interest-ledger.js';

import { readInterestLedger } from '../read-interest-ledger.js';
import { daysBetween } from '../dates.js';
import { decimal } from '../money.js';
import { validateMoney } from '../validate-money.js';
import { validateInterest } from '../validate-interest.js';

import { validateObligationLedger } from './validate-obligation-ledger.js';

export function buildFixedInterestPlan(
  input: FixedInterestPlanInput,
): readonly PaymentObligation[] {
  if (
    typeof input !== 'object' ||
    input === null ||
    !Array.isArray(input.periods)
  ) {
    throw new Error('Некорректные условия процентного плана');
  }

  validateMoney(input.principal, true);
  validateInterest(input.terms);

  let ledger = createInterestLedger(input.roundingMode);
  let previousRounded = decimal('0');
  let previousEnd: string | null = null;

  const result: PaymentObligation[] = [];

  for (const period of input.periods) {
    if (period.toOnExclusive !== period.dueOn) {
      throw new Error('Конец периода должен совпадать с датой оплаты');
    }

    if (daysBetween(period.fromOn, period.toOnExclusive) <= 0) {
      throw new Error('Процентный период должен быть положительным');
    }

    if (previousEnd !== null && period.fromOn !== previousEnd) {
      throw new Error(
        'Процентные периоды должны идти без разрывов и пересечений',
      );
    }

    const interest = calculatePeriodInterest({
      principal: input.principal,
      fromOn: period.fromOn,
      toOnExclusive: period.toOnExclusive,
      terms: input.terms,
    });

    ledger = accrueInterest(ledger, interest);

    const cumulative = decimal(readInterestLedger(ledger).accruedTotal);

    const periodAmount = cumulative.minus(previousRounded);

    result.push({
      key: period.key,
      component: 'INTEREST',
      dueOn: period.dueOn,

      amount: periodAmount.toFixed(2),

      periodFromOn: period.fromOn,
      periodToOnExclusive: period.toOnExclusive,
    });

    previousRounded = cumulative;
    previousEnd = period.toOnExclusive;
  }

  validateObligationLedger(result, []);

  return result;
}
