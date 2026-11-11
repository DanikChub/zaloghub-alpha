import type {
  InterestScheduleInput,
  InterestSchedulePeriod,
} from './schedule.types.js';

import { daysBetween, validateLocalDate } from '../dates.js';

import {
  nextMonthlyPaymentDate,
  paymentDateInMonth,
} from './monthly-payment-date.js';

export function buildInterestSchedule(
  input: InterestScheduleInput,
): readonly InterestSchedulePeriod[] {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Условия графика должны быть объектом');
  }

  const {
    accrualStartOn,
    firstPaymentOn,
    paymentDay,
    maturityOn,
    missingPaymentDay,
  } = input;

  validateLocalDate(accrualStartOn);
  validateLocalDate(firstPaymentOn);
  validateLocalDate(maturityOn);

  if (firstPaymentOn <= accrualStartOn) {
    throw new Error('Первый платёж должен быть позже начала начисления');
  }

  if (maturityOn <= accrualStartOn) {
    throw new Error('Срок возврата должен быть позже начала начисления');
  }

  const alignedFirstPayment = paymentDateInMonth(
    firstPaymentOn,
    paymentDay,
    missingPaymentDay,
  );

  if (alignedFirstPayment !== firstPaymentOn) {
    throw new Error('Первая дата не соответствует дню платежа');
  }

  const result: InterestSchedulePeriod[] = [];

  let fromOn = accrualStartOn;
  let plannedDueOn = firstPaymentOn;

  while (fromOn < maturityOn) {
    const dueOn = plannedDueOn < maturityOn ? plannedDueOn : maturityOn;

    const startsOnPaymentDay =
      paymentDateInMonth(fromOn, paymentDay, missingPaymentDay) === fromOn;

    const isFullMonthlyPeriod =
      startsOnPaymentDay &&
      fromOn.slice(0, 7) !== dueOn.slice(0, 7) &&
      nextMonthlyPaymentDate(fromOn, paymentDay, missingPaymentDay) === dueOn;

    result.push({
      key: `interest:${dueOn}`,
      sequenceNo: result.length + 1,

      fromOn,
      toOnExclusive: dueOn,
      dueOn,

      days: daysBetween(fromOn, dueOn),

      isFirst: result.length === 0,
      isFinal: dueOn === maturityOn,
      isFullMonthlyPeriod,
    });

    if (dueOn === maturityOn) {
      break;
    }

    fromOn = dueOn;

    // В последнем месяце после очередной даты оплаты
    // остаётся только заключительный период до maturityOn.
    if (fromOn.slice(0, 7) === maturityOn.slice(0, 7)) {
      plannedDueOn = maturityOn;
    } else {
      plannedDueOn = nextMonthlyPaymentDate(
        fromOn,
        paymentDay,
        missingPaymentDay,
      );
    }
  }

  return result;
}
