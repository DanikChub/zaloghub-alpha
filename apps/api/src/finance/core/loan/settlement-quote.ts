import type { LoanCalculationResult, LoanTerms } from './loan.types.js';
import { decimal, formatMoney } from '../money.js';

export function settlementAmounts(
  terms: LoanTerms,
  day: string,
  principal: string,
  accrued: string,
  interestPaid: string,
  penalty: string,
) {
  const insideMoratorium =
    terms.principalRepaymentFromOn !== undefined &&
    day < terms.principalRepaymentFromOn;
  if (insideMoratorium && !terms.settlement)
    throw new Error(
      'Не настроены условия согласованного закрытия во время моратория',
    );
  const minimum = insideMoratorium
    ? decimal(terms.contractAmount)
        .times(terms.settlement!.minimumInterestRate)
        .times(terms.settlement!.minimumInterestMonths)
    : decimal('0');
  const minimumTotal = decimal(formatMoney(minimum, terms.roundingMode));
  const target = minimumTotal.greaterThan(accrued)
    ? minimumTotal
    : decimal(accrued);
  const interestRemaining = target.minus(interestPaid);
  return {
    insideMoratorium,
    minimumInterestTotal: minimumTotal.toFixed(2),
    interestTarget: target.toFixed(2),
    interestPaid,
    interestRemaining: (interestRemaining.isNegative()
      ? decimal('0')
      : interestRemaining
    ).toFixed(2),
    releasedPrepaidInterest: (interestRemaining.isNegative()
      ? interestRemaining.negated()
      : decimal('0')
    ).toFixed(2),
    principal,
    penalty,
    amountToClose: decimal(principal)
      .plus(penalty)
      .plus(interestRemaining.isNegative() ? '0' : interestRemaining)
      .toFixed(2),
  };
}

/** Предложение на конец дня. Оно само не меняет ни деньги, ни договор. */
export function quoteSettlement(
  terms: LoanTerms,
  result: LoanCalculationResult,
) {
  if (result.settledOn)
    throw new Error('Займ уже закрыт согласованной операцией');
  if (decimal(result.disbursedTotal).isZero())
    throw new Error('Нет фактических выдач для закрытия');
  const amounts = settlementAmounts(
    terms,
    result.asOfOn,
    result.principalOutstanding,
    result.interestAccrued,
    result.interestPaid,
    result.penaltyOutstanding,
  );
  const reservedRefund = result.credits.reduce(
    (sum, c) => sum.plus(c.reservedForRefund),
    decimal('0'),
  );
  const usable = decimal(result.unappliedCredit)
    .minus(reservedRefund)
    .plus(amounts.releasedPrepaidInterest);
  const additional = decimal(amounts.amountToClose).minus(usable);
  return {
    ...amounts,
    on: result.asOfOn,
    availableForSettlement: usable.toFixed(2),
    additionalPaymentRequired: (additional.isNegative()
      ? decimal('0')
      : additional
    ).toFixed(2),
    requiresInvestorAgreement: true as const,
    calculationMoment: 'END_OF_DAY' as const,
  };
}
