import type { MonthlyInterestTerms } from './interest.types.js';

export function validateInterest(interest: MonthlyInterestTerms): void {
  if (typeof interest !== 'object' || interest === null) {
    throw new Error('Процентные условия должны быть объектом');
  }

  if (interest.kind !== 'MONTHLY') {
    throw new Error('Поддерживается только месячная ставка');
  }

  if (interest.accrualBase !== 'OUTSTANDING_PRINCIPAL') {
    throw new Error('Неподдерживаемая база начисления процентов');
  }

  if (
    interest.dailyRateDivisor !== 'CALENDAR_MONTH_DAYS' &&
    interest.dailyRateDivisor !== 'FIXED_30_DAYS'
  ) {
    throw new Error('Неподдерживаемый делитель месячной ставки');
  }

  if (
    typeof interest.rate !== 'string' ||
    !/^(0|[1-9]\d{0,7})(\.\d{1,10})?$/.test(interest.rate)
  ) {
    throw new Error('Некорректная процентная ставка');
  }
}
