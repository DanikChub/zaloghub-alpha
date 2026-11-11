import type { Decimal } from 'decimal.js';
import type { FinancialEvent, LocalDate } from '../finance.types.js';
import type {
  ObligationAllocation,
  PaymentObligation,
} from '../obligations/obligation.types.js';
import type {
  LoanAccrual,
  LoanCalculationInput,
  LoanCalculationResult,
} from './loan.types.js';
import { decimal, formatMoney } from '../money.js';
import { nextDay } from '../dates.js';
import { prepareEvents } from '../prepare-events.js';
import { calculatePeriodInterest } from '../calculate-period-interest.js';
import { buildInterestSchedule } from '../schedule/build-interest-schedule.js';
import { allocateReceipt } from '../obligations/allocate-receipt.js';
import { readObligations } from '../obligations/read-obligations.js';
import { addMonthsClamped } from './loan-dates.js';
import { validateLoan } from './validate-loan.js';
import {
  LoanCreditLedger,
  prepareLoanActions,
  protectedReceiptAmounts,
} from './loan-credit-ledger.js';
import { settlementAmounts } from './settlement-quote.js';

/**
 * Чистый расчёт из фактов. Ретроактивные правила требуют повторного
 * воспроизведения: новые ставки меняют и начисления, и очередь платежей.
 */
export function calculateLoan(
  input: LoanCalculationInput,
): LoanCalculationResult {
  validateLoan(input);
  const overrides = new Map<LocalDate, string>();
  let lossOn: LocalDate | null = null;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const pass = replay(input, lossOn, overrides);
    let changed = false;
    if (pass.lossOn !== null && (lossOn === null || pass.lossOn < lossOn)) {
      lossOn = pass.lossOn;
      changed = true;
    }
    for (const [start, rate] of pass.increases) {
      if (!overrides.has(start)) {
        overrides.set(start, rate);
        changed = true;
      }
    }
    if (!changed) return pass.result;
  }
  throw new Error('Не удалось стабилизировать ретроактивный расчёт');
}

function replay(
  input: LoanCalculationInput,
  lossOn: LocalDate | null,
  penaltyOverrides: ReadonlyMap<LocalDate, string>,
) {
  const { terms, asOfOn } = input;
  const periods = buildInterestSchedule(terms.schedule);
  const events = prepareEvents(input.events, asOfOn);
  const actions = prepareLoanActions(input.actions, asOfOn);
  const protectedAmounts = protectedReceiptAmounts(actions);
  let actionIndex = 0;
  let settledOn: string | null = null;
  const obligations = new Map<string, PaymentObligation>();
  const allocations: ObligationAllocation[] = [];
  const creditLedger = new LoanCreditLedger(allocations);
  const accruals: LoanAccrual[] = [];
  const rawInterest = new Map<string, Decimal>();
  const interestPrefixes = new Map<string, Decimal>();
  const increases = new Map<LocalDate, string>();
  const penaltyPrefixes = new Map<string, Decimal>();
  const received: FinancialEvent[] = [];
  const workingDays = [...(terms.rateLoss?.calendar.workingDays ?? [])].sort();
  let detectedLoss = lossOn;
  let disbursed = decimal('0');
  let receivedTotal = decimal('0');
  let interestTotal = decimal('0');
  let penaltyTotal = decimal('0');
  let episode: LocalDate | null = null;
  let eventIndex = 0;
  let periodIndex = 0;
  const money = (amount: Decimal) => formatMoney(amount, terms.roundingMode);
  const list = () => [...obligations.values()];
  const paid = (key: string) =>
    allocations
      .filter((a) => a.obligationKey === key)
      .reduce((sum, a) => sum.plus(a.amount), decimal('0'));
  const principalPaid = () => paid('principal');
  const principal = () => disbursed.minus(principalPaid());
  const balance = (obligation: PaymentObligation) =>
    decimal(obligation.amount).minus(paid(obligation.key));
  const rateOn = (day: LocalDate) =>
    lossOn !== null && day >= lossOn
      ? terms.rateLoss!.standardRate
      : terms.interest.rate;

  function rawFor(
    fromOn: LocalDate,
    toOnExclusive: LocalDate,
    base: Decimal,
  ): Decimal {
    if (fromOn >= toOnExclusive || base.isZero()) return decimal('0');
    if (lossOn !== null && fromOn < lossOn && lossOn < toOnExclusive) {
      return rawFor(fromOn, lossOn, base).plus(
        rawFor(lossOn, toOnExclusive, base),
      );
    }
    return calculatePeriodInterest({
      principal: base.toFixed(2),
      fromOn,
      toOnExclusive,
      terms: { ...terms.interest, rate: rateOn(fromOn) },
    });
  }

  // Уменьшение прогнозных процентов может высвободить часть ранней оплаты.
  // Это удержанный остаток того же поступления, а не новое поступление.
  function setInterest(obligation: PaymentObligation): void {
    let excess = paid(obligation.key).minus(obligation.amount);
    for (
      let i = allocations.length - 1;
      excess.greaterThan(0) && i >= 0;
      i -= 1
    ) {
      const row = allocations[i];
      if (row.obligationKey !== obligation.key) continue;
      const amount = decimal(row.amount);
      const release = amount.lessThan(excess) ? amount : excess;
      if (release.equals(amount)) allocations.splice(i, 1);
      else
        allocations[i] = { ...row, amount: amount.minus(release).toFixed(2) };
      excess = excess.minus(release);
    }
    obligations.set(obligation.key, obligation);
  }

  function updateCurrent(day: LocalDate, afterAccrual: boolean): void {
    const period = periods[periodIndex];
    if (!period || day < period.fromOn || day >= period.toOnExclusive) return;
    if (!interestPrefixes.has(period.key))
      interestPrefixes.set(period.key, interestTotal);
    const prefix = interestPrefixes.get(period.key)!;
    const actual = rawInterest.get(period.key) ?? decimal('0');
    const from = afterAccrual ? nextDay(day) : day;
    const forecast = rawFor(from, period.toOnExclusive, principal());
    const amount = decimal(money(prefix.plus(actual).plus(forecast))).minus(
      money(prefix),
    );
    setInterest({
      key: period.key,
      component: 'INTEREST',
      dueOn: period.dueOn,
      amount: amount.toFixed(2),
      periodFromOn: period.fromOn,
      periodToOnExclusive: period.toOnExclusive,
    });
  }

  function arrears(day: LocalDate): PaymentObligation[] {
    return list()
      .filter(
        (o) =>
          (o.component === 'INTEREST' || o.component === 'PRINCIPAL') &&
          o.dueOn < day &&
          balance(o).greaterThan(0),
      )
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  }

  function accruePenalty(day: LocalDate): void {
    const overdue = arrears(day);
    if (overdue.length === 0) {
      episode = null;
      return;
    }
    if (!terms.penalty) return;
    if (episode === null) episode = overdue[0].dueOn;
    const key = `penalty:${episode}`;
    if (!penaltyPrefixes.has(key)) penaltyPrefixes.set(key, penaltyTotal);
    const increase = terms.penalty.increase;
    const oldestInterest = overdue.find((o) => o.component === 'INTEREST');
    const elevated =
      increase &&
      oldestInterest &&
      day >= addMonthsClamped(oldestInterest.dueOn, increase.afterMonths);
    if (elevated && increase.retrospective)
      increases.set(episode, increase.dailyRate);
    const rate =
      penaltyOverrides.get(episode) ??
      (elevated ? increase!.dailyRate : terms.penalty.dailyRate);
    const base =
      terms.penalty.base === 'CONTRACT_AMOUNT'
        ? decimal(terms.contractAmount)
        : terms.penalty.base === 'OUTSTANDING_PRINCIPAL'
          ? principal()
          : overdue.reduce((sum, o) => sum.plus(balance(o)), decimal('0'));
    const raw = base.times(rate);
    const before = money(penaltyTotal);
    penaltyTotal = penaltyTotal.plus(raw);
    const amount = decimal(money(penaltyTotal)).minus(
      money(penaltyPrefixes.get(key)!),
    );
    obligations.set(key, {
      key,
      component: 'PENALTY',
      dueOn: nextDay(episode),
      amount: amount.toFixed(2),
      periodFromOn: null,
      periodToOnExclusive: null,
    });
    accruals.push({
      effectiveOn: day,
      obligationKey: key,
      component: 'PENALTY',
      base: base.toFixed(2),
      rate,
      rawAmount: raw.toFixed(),
      amount: decimal(money(penaltyTotal)).minus(before).toFixed(2),
    });
  }

  function upperBound(day: LocalDate): number {
    let left = 0,
      right = workingDays.length;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (workingDays[middle] <= day) left = middle + 1;
      else right = middle;
    }
    return left;
  }

  function detectRateLoss(day: LocalDate): void {
    const rule = terms.rateLoss;
    if (!rule) return;
    for (const obligation of arrears(day).filter(
      (o) => o.component === 'INTEREST',
    )) {
      const partial =
        rule.partialPaymentTriggers && paid(obligation.key).greaterThan(0);
      const workingDelay = upperBound(day) - upperBound(obligation.dueOn);
      if (partial || workingDelay > rule.graceWorkingDays) {
        const from = `${obligation.dueOn.slice(0, 7)}-01`;
        if (detectedLoss === null || from < detectedLoss) detectedLoss = from;
      }
    }
  }

  function ensureTarget(key: string, day: string): PaymentObligation {
    const target = periods.find((p) => p.key === key);
    if (!target) throw new Error('Неизвестный процентный период для зачёта');
    const existing = obligations.get(key);
    if (existing && target.fromOn <= day) return existing;
    let prefix = interestTotal;
    for (const period of periods) {
      if (period.dueOn <= day) continue;
      const from = period.fromOn > day ? period.fromOn : nextDay(day);
      const raw = rawFor(from, period.toOnExclusive, principal());
      if (period.key === key) {
        const value: PaymentObligation = {
          key,
          component: 'INTEREST',
          dueOn: period.dueOn,
          amount: decimal(money(prefix.plus(raw)))
            .minus(money(prefix))
            .toFixed(2),
          periodFromOn: period.fromOn,
          periodToOnExclusive: period.toOnExclusive,
        };
        obligations.set(key, value);
        return value;
      }
      prefix = prefix.plus(raw);
    }
    throw new Error('Период зачёта уже завершён');
  }

  function executeSettlement(day: string): void {
    if (settledOn) throw new Error('Повторное закрытие займа');
    if (disbursed.isZero()) throw new Error('Нет выдач для закрытия');
    // Завершаем текущий период фактическими процентами; предоплату высвобождаем.
    for (const obligation of list().filter(
      (o) => o.component === 'INTEREST' && o.dueOn > day,
    )) {
      const prefix = interestPrefixes.get(obligation.key) ?? interestTotal;
      const actual = rawInterest.get(obligation.key) ?? decimal('0');
      setInterest({
        ...obligation,
        amount: decimal(money(prefix.plus(actual)))
          .minus(money(prefix))
          .toFixed(2),
      });
    }
    creditLedger.releaseFutureCredits();
    const interestPaid = list()
      .filter((o) => o.component === 'INTEREST')
      .reduce((sum, o) => sum.plus(paid(o.key)), decimal('0'));
    const penaltyPaid = list()
      .filter((o) => o.component === 'PENALTY')
      .reduce((sum, o) => sum.plus(paid(o.key)), decimal('0'));
    const quote = settlementAmounts(
      terms,
      day,
      principal().toFixed(2),
      money(interestTotal),
      interestPaid.toFixed(2),
      decimal(money(penaltyTotal)).minus(penaltyPaid).toFixed(2),
    );
    const topUp = decimal(quote.interestTarget).minus(money(interestTotal));
    if (topUp.greaterThan(0)) {
      const key = `interest:minimum-settlement:${day}`;
      obligations.set(key, {
        key,
        component: 'INTEREST',
        dueOn: day,
        amount: topUp.toFixed(2),
        periodFromOn: null,
        periodToOnExclusive: null,
      });
      const rawAdjustment = decimal(quote.interestTarget).minus(interestTotal);
      interestTotal = decimal(quote.interestTarget);
      accruals.push({
        effectiveOn: day,
        obligationKey: key,
        component: 'INTEREST',
        base: terms.contractAmount,
        rate: terms.settlement!.minimumInterestRate,
        rawAmount: rawAdjustment.toFixed(),
        amount: topUp.toFixed(2),
      });
    }
    for (const component of terms.allocation.componentOrder) {
      for (const obligation of list()
        .filter((o) => o.component === component)
        .sort(
          (a, b) =>
            a.dueOn.localeCompare(b.dueOn) || a.key.localeCompare(b.key),
        )) {
        const remaining = balance(obligation);
        if (remaining.greaterThan(0))
          creditLedger.fund(obligation.key, remaining.toFixed(2), day);
      }
    }
    settledOn = day;
  }

  for (
    let day = terms.schedule.accrualStartOn;
    day <= asOfOn;
    day = nextDay(day)
  ) {
    while (periods[periodIndex] && periods[periodIndex].dueOn <= day) {
      const completed = periods[periodIndex];
      const prefix = interestPrefixes.get(completed.key) ?? interestTotal;
      const actual = rawInterest.get(completed.key) ?? decimal('0');
      setInterest({
        key: completed.key,
        component: 'INTEREST',
        dueOn: completed.dueOn,
        amount: decimal(money(prefix.plus(actual)))
          .minus(money(prefix))
          .toFixed(2),
        periodFromOn: completed.fromOn,
        periodToOnExclusive: completed.toOnExclusive,
      });
      periodIndex += 1;
    }

    // Для INCLUDED база фиксируется до операций дня; EXCLUDED — после них.
    if (terms.penalty?.paymentDay === 'INCLUDED') accruePenalty(day);
    while (events[eventIndex]?.effectiveOn === day) {
      const event = events[eventIndex++];
      if (event.kind === 'DISBURSEMENT') {
        if (settledOn) throw new Error('Выдача после согласованного закрытия');
        disbursed = disbursed.plus(event.amount);
        if (disbursed.greaterThan(terms.contractAmount))
          throw new Error('Выдачи превышают сумму договора');
        obligations.set('principal', {
          key: 'principal',
          component: 'PRINCIPAL',
          dueOn: terms.schedule.maturityOn,
          amount: disbursed.toFixed(2),
          periodFromOn: null,
          periodToOnExclusive: null,
        });
        updateCurrent(day, false);
      } else {
        received.push(event);
        creditLedger.receive(event);
        receivedTotal = receivedTotal.plus(event.amount);
        updateCurrent(day, false);
        const spend = decimal(event.amount).minus(
          protectedAmounts.get(event.id) ?? '0',
        );
        if (spend.isNegative())
          throw new Error('Распоряжения превышают исходное поступление');
        // Закрытие наступившего платежа не является согласием оплатить следующий.
        const payingDue = list().some(
          (o) => o.dueOn <= day && balance(o).greaterThan(0),
        );
        const result = spend.isZero()
          ? { allocations: [] }
          : allocateReceipt({
              receipt: { ...event, amount: spend.toFixed(2) },
              obligations: list(),
              previousAllocations: allocations,
              policy: {
                ...terms.allocation,
                earlyInterest: payingDue
                  ? 'NONE'
                  : terms.allocation.earlyInterest,
                earlyPrincipal:
                  payingDue ||
                  (terms.principalRepaymentFromOn &&
                    day < terms.principalRepaymentFromOn)
                    ? 'BLOCKED'
                    : terms.allocation.earlyPrincipal,
              },
            });
        allocations.push(...result.allocations);
        updateCurrent(day, false);
      }
    }
    if (terms.penalty?.paymentDay === 'EXCLUDED') accruePenalty(day);

    const period = periods[periodIndex];
    const key =
      period && day < period.dueOn
        ? period.key
        : `interest:after-maturity:${day}`;
    if (!interestPrefixes.has(key)) interestPrefixes.set(key, interestTotal);
    const raw = rawFor(day, nextDay(day), principal());
    const before = money(interestTotal);
    interestTotal = interestTotal.plus(raw);
    rawInterest.set(key, (rawInterest.get(key) ?? decimal('0')).plus(raw));
    if (day >= terms.schedule.maturityOn && !raw.isZero()) {
      obligations.set(key, {
        key,
        component: 'INTEREST',
        dueOn: day,
        amount: decimal(money(interestTotal)).minus(before).toFixed(2),
        periodFromOn: day,
        periodToOnExclusive: nextDay(day),
      });
    } else updateCurrent(day, true);
    if (!raw.isZero())
      accruals.push({
        effectiveOn: day,
        obligationKey: key,
        component: 'INTEREST',
        base: principal().toFixed(2),
        rate: rateOn(day),
        rawAmount: raw.toFixed(),
        amount: decimal(money(interestTotal)).minus(before).toFixed(2),
      });
    creditLedger.activate(day, (key) => ensureTarget(key, day));
    while (actions[actionIndex]?.effectiveOn === day) {
      const action = actions[actionIndex++];
      if (action.kind === 'SETTLEMENT') executeSettlement(day);
      else creditLedger.apply(action, (key) => ensureTarget(key, day));
    }
    creditLedger.activate(day, (key) => ensureTarget(key, day));
    detectRateLoss(day);
  }

  // Будущее является прогнозом при текущем теле и без новых операций.
  const current = periods[periodIndex];
  let prefix =
    current && asOfOn >= current.fromOn && asOfOn < current.dueOn
      ? interestTotal.plus(rawFor(nextDay(asOfOn), current.dueOn, principal()))
      : interestTotal;
  for (const period of periods) {
    if (period.fromOn <= asOfOn) continue;
    const raw = rawFor(period.fromOn, period.toOnExclusive, principal());
    const amount = decimal(money(prefix.plus(raw))).minus(money(prefix));
    obligations.set(period.key, {
      key: period.key,
      component: 'INTEREST',
      dueOn: period.dueOn,
      amount: amount.toFixed(2),
      periodFromOn: period.fromOn,
      periodToOnExclusive: period.toOnExclusive,
    });
    prefix = prefix.plus(raw);
  }
  const snapshot = readObligations(list(), allocations, asOfOn);
  const allocatedTo = (component: string) =>
    allocations
      .filter((a) => obligations.get(a.obligationKey)!.component === component)
      .reduce((sum, a) => sum.plus(a.amount), decimal('0'));
  const interestPaid = allocatedTo('INTEREST');
  const penaltyPaid = allocatedTo('PENALTY');
  const interestUnpaid = decimal(money(interestTotal)).minus(interestPaid);
  const penaltyUnpaid = decimal(money(penaltyTotal)).minus(penaltyPaid);
  const allocated = allocations.reduce(
    (sum, a) => sum.plus(a.amount),
    decimal('0'),
  );
  const zeroFloor = (amount: Decimal) =>
    amount.isNegative() ? decimal('0') : amount;
  const credits = creditLedger.snapshot();
  const refundedTotal = credits.reduce(
    (sum, c) => sum.plus(c.refundedAmount),
    decimal('0'),
  );
  const availableCredit = credits.reduce(
    (sum, c) => sum.plus(c.availableAmount),
    decimal('0'),
  );
  const reservedCredit = credits.reduce(
    (sum, c) => sum.plus(c.reservedForRefund).plus(c.reservedForFuture),
    decimal('0'),
  );
  const result: LoanCalculationResult = {
    engineVersion: 'loan-v2',
    loanId: input.loanId,
    currency: input.currency,
    asOfOn,
    disbursedTotal: disbursed.toFixed(2),
    receivedTotal: receivedTotal.toFixed(2),
    principalOutstanding: principal().toFixed(2),
    principalReturned: principalPaid().toFixed(2),
    interestAccrued: money(interestTotal),
    interestOutstanding: zeroFloor(interestUnpaid).toFixed(2),
    interestPaid: interestPaid.toFixed(2),
    prepaidInterest: zeroFloor(interestUnpaid.negated()).toFixed(2),
    penaltyAccrued: money(penaltyTotal),
    penaltyOutstanding: penaltyUnpaid.toFixed(2),
    penaltyPaid: penaltyPaid.toFixed(2),
    unappliedCredit: receivedTotal
      .minus(allocated)
      .minus(refundedTotal)
      .toFixed(2),
    refundedTotal: refundedTotal.toFixed(2),
    availableCredit: availableCredit.toFixed(2),
    reservedCredit: reservedCredit.toFixed(2),
    credits,
    creditReservations: creditLedger.reservations(),
    settledOn,
    totalOutstanding: principal()
      .plus(zeroFloor(interestUnpaid))
      .plus(penaltyUnpaid)
      .toFixed(2),
    rateLossEffectiveOn: lossOn,
    snapshot,
    allocations,
    accruals,
    payments: received.map((event) => {
      const rows = allocations.filter((a) => a.paymentId === event.id);
      const applied = rows.reduce((sum, a) => sum.plus(a.amount), decimal('0'));
      return {
        paymentId: event.id,
        effectiveOn: event.effectiveOn,
        amount: event.amount,
        allocatedAmount: applied.toFixed(2),
        unallocatedAmount: decimal(event.amount)
          .minus(applied)
          .minus(
            credits.find((c) => c.receiptId === event.id)?.refundedAmount ??
              '0',
          )
          .toFixed(2),
        allocations: rows,
      };
    }),
    forecastAssumption: 'CURRENT_PRINCIPAL_AND_RATE',
  };
  return { result, lossOn: detectedLoss, increases };
}
