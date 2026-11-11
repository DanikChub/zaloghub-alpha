import type { LoanCalculationInput } from './loan.types.js';
import { daysBetween, validateLocalDate } from '../dates.js';
import { validateEvents } from '../validate-events.js';
import { validateMoney } from '../validate-money.js';
import { validateInterest } from '../validate-interest.js';
import { decimal, formatMoney } from '../money.js';
import { validateReceiptAllocationPolicy } from '../obligations/receipt-allocation-policy.js';
import { buildInterestSchedule } from '../schedule/build-interest-schedule.js';
import { prepareLoanActions } from './loan-credit-ledger.js';

function rate(value: string): void {
  if (
    typeof value !== 'string' ||
    !/^(0|[1-9]\d{0,5})(\.\d{1,10})?$/.test(value)
  ) {
    throw new Error('Некорректная ставка');
  }
}

function fields(
  value: unknown,
  allowed: readonly string[],
  label: string,
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label}: требуется объект`);
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`${label}: неизвестное поле ${unknown}`);
}

export function validateLoan(input: LoanCalculationInput): void {
  if (!input || typeof input !== 'object')
    throw new Error('Некорректный вход расчёта займа');
  if (typeof input.loanId !== 'string' || !input.loanId.trim())
    throw new Error('Не указан займ');
  if (input.currency !== 'RUB') throw new Error('Поддерживается только RUB');
  validateLocalDate(input.asOfOn);
  if (input.asOfOn === '9999-12-31')
    throw new Error('Недоступна следующая дата');
  const t = input.terms;
  if (!t || t.version !== 1) throw new Error('Неподдерживаемая версия условий');
  fields(
    t,
    [
      'version',
      'contractAmount',
      'schedule',
      'interest',
      'roundingMode',
      'allocation',
      'principalRepaymentFromOn',
      'penalty',
      'rateLoss',
      'calendarVersionIds',
      'settlement',
    ],
    'Условия',
  );
  fields(
    t.schedule,
    [
      'accrualStartOn',
      'firstPaymentOn',
      'paymentDay',
      'maturityOn',
      'missingPaymentDay',
    ],
    'График',
  );
  fields(
    t.interest,
    ['kind', 'rate', 'accrualBase', 'dailyRateDivisor'],
    'Проценты',
  );
  fields(
    t.allocation,
    [
      'priority',
      'componentOrder',
      'earlyInterest',
      'earlyPrincipal',
      'unappliedFunds',
    ],
    'Распределение',
  );
  validateMoney(t.contractAmount, false);
  validateInterest(t.interest);
  validateReceiptAllocationPolicy(t.allocation);
  formatMoney(decimal('0'), t.roundingMode);
  if (!['HALF_UP', 'HALF_EVEN', 'DOWN'].includes(t.roundingMode))
    throw new Error('Некорректное округление');
  if (
    !t.schedule ||
    daysBetween(t.schedule.accrualStartOn, t.schedule.maturityOn) > 36600 ||
    daysBetween(t.schedule.accrualStartOn, input.asOfOn) > 36600
  ) {
    throw new Error('Расчёт ограничен ста годами');
  }
  buildInterestSchedule(t.schedule);
  validateEvents(input.events);
  const actions = prepareLoanActions(input.actions, input.asOfOn);
  if (actions.some((a) => a.effectiveOn < t.schedule.accrualStartOn))
    throw new Error('Распоряжение раньше начала займа');
  if (
    t.calendarVersionIds !== undefined &&
    (!Array.isArray(t.calendarVersionIds) ||
      t.calendarVersionIds.some((id) => typeof id !== 'string'))
  )
    throw new Error('Неверные ссылки на календарь');
  if (t.settlement !== undefined) {
    fields(
      t.settlement,
      ['minimumInterestRate', 'minimumInterestMonths'],
      'Согласованное закрытие',
    );
    rate(t.settlement.minimumInterestRate);
    if (
      !t.principalRepaymentFromOn ||
      !Number.isInteger(t.settlement.minimumInterestMonths) ||
      t.settlement.minimumInterestMonths < 1 ||
      t.settlement.minimumInterestMonths > 1200
    )
      throw new Error(
        'Не заданы условия моратория для согласованного закрытия',
      );
  }
  if (input.events.length > 10000) throw new Error('Слишком много операций');
  if (input.events.some((e) => e.effectiveOn < t.schedule.accrualStartOn))
    throw new Error('Операция раньше начала займа');
  if (t.principalRepaymentFromOn !== undefined)
    validateLocalDate(t.principalRepaymentFromOn);
  if (t.penalty !== undefined) {
    fields(t.penalty, ['dailyRate', 'base', 'paymentDay', 'increase'], 'Пени');
    rate(t.penalty.dailyRate);
    if (
      !['CONTRACT_AMOUNT', 'OUTSTANDING_PRINCIPAL', 'OVERDUE_BALANCE'].includes(
        t.penalty.base,
      )
    )
      throw new Error('Некорректная база пени');
    if (!['INCLUDED', 'EXCLUDED'].includes(t.penalty.paymentDay))
      throw new Error('Некорректное правило дня платежа');
    const increase = t.penalty.increase;
    if (increase !== undefined) {
      fields(
        increase,
        ['afterMonths', 'dailyRate', 'retrospective'],
        'Повышение пени',
      );
      if (
        !Number.isSafeInteger(increase.afterMonths) ||
        increase.afterMonths < 1 ||
        increase.afterMonths > 1200
      )
        throw new Error('Некорректный срок повышения пени');
      rate(increase.dailyRate);
      if (decimal(increase.dailyRate).lessThan(t.penalty.dailyRate))
        throw new Error('Повышенная пеня меньше исходной');
      if (typeof increase.retrospective !== 'boolean')
        throw new Error('Не задана ретроактивность пени');
    }
  }
  if (t.rateLoss !== undefined) {
    fields(
      t.rateLoss,
      [
        'standardRate',
        'graceWorkingDays',
        'partialPaymentTriggers',
        'retrospective',
        'calendar',
      ],
      'Утрата льготы',
    );
    const loss = t.rateLoss;
    rate(loss.standardRate);
    if (decimal(loss.standardRate).lessThan(t.interest.rate))
      throw new Error('Стандартная ставка меньше льготной');
    if (
      loss.retrospective !== 'DUE_MONTH' ||
      typeof loss.partialPaymentTriggers !== 'boolean' ||
      !Number.isSafeInteger(loss.graceWorkingDays) ||
      loss.graceWorkingDays < 0 ||
      loss.graceWorkingDays > 366
    )
      throw new Error('Некорректное правило утраты льготы');
    const c = loss.calendar;
    fields(c, ['fromOn', 'toOn', 'workingDays'], 'Рабочий календарь');
    if (!c || !Array.isArray(c.workingDays))
      throw new Error('Не задан рабочий календарь');
    validateLocalDate(c.fromOn);
    validateLocalDate(c.toOn);
    if (
      c.fromOn > t.schedule.accrualStartOn ||
      c.toOn < input.asOfOn ||
      c.toOn < c.fromOn
    )
      throw new Error('Рабочий календарь не покрывает расчёт');
    if (new Set(c.workingDays).size !== c.workingDays.length)
      throw new Error('Повтор рабочих дней');
    for (const day of c.workingDays) {
      validateLocalDate(day);
      if (day < c.fromOn || day > c.toOn)
        throw new Error('Рабочий день вне покрытия');
    }
  }
}
