import { describe, expect, it } from 'vitest';

import type { FinanceCalculationInput } from './calculation-input.types.js';

import { validateInput } from './validate-input.js';

function createInput(): FinanceCalculationInput {
  return {
    loanId: 'loan-1',
    currency: 'RUB',
    asOfOn: '2026-11-05',

    interest: {
      kind: 'MONTHLY',
      rate: '0.04',
      accrualBase: 'OUTSTANDING_PRINCIPAL',
      dailyRateDivisor: 'CALENDAR_MONTH_DAYS',
    },

    policy: {
      interestRoundingMethod: 'CUMULATIVE_TOTAL',
      interestRoundingMode: 'HALF_UP',
      paymentAllocationOrder: 'INTEREST_THEN_PRINCIPAL',
      eventTiming: 'BEFORE_DAILY_ACCRUAL',
      principalRepayment: 'ALLOWED',
      unappliedFunds: 'HOLD',
    },

    events: [
      {
        id: 'disbursement-1',
        kind: 'DISBURSEMENT',
        effectiveOn: '2026-11-01',
        sequenceNo: 1,
        amount: '650000.00',
      },
    ],
  };
}

function validate(value: unknown): void {
  validateInput(value as FinanceCalculationInput);
}

describe('Проверка входа финансового расчёта', () => {
  it('принимает корректный вход', () => {
    expect(() => validateInput(createInput())).not.toThrow();
  });

  it('не изменяет переданные данные', () => {
    const input = createInput();
    const original = structuredClone(input);

    validateInput(input);

    expect(input).toEqual(original);
  });

  it('принимает события позже даты расчёта', () => {
    const input = createInput();

    expect(() =>
      validate({
        ...input,
        asOfOn: '2026-10-01',
      }),
    ).not.toThrow();
  });

  it.each(['', '   '])('отклоняет пустой идентификатор "%s"', (loanId) => {
    expect(() =>
      validate({
        ...createInput(),
        loanId,
      }),
    ).toThrow('идентификатор займа');
  });

  it('отклоняет неподдерживаемую валюту', () => {
    expect(() =>
      validate({
        ...createInput(),
        currency: 'JPY',
      }),
    ).toThrow('поддерживается только RUB');
  });

  it('проверяет дату расчёта', () => {
    expect(() =>
      validate({
        ...createInput(),
        asOfOn: '2026-02-30',
      }),
    ).toThrow();
  });

  it('проверяет вложенные процентные условия', () => {
    expect(() =>
      validate({
        ...createInput(),
        interest: null,
      }),
    ).toThrow();
  });

  it('проверяет вложенные события', () => {
    expect(() =>
      validate({
        ...createInput(),
        events: null,
      }),
    ).toThrow();
  });

  it.each([null, undefined, 'input'])(
    'отклоняет неправильную структуру: %j',
    (value) => {
      expect(() => validate(value)).toThrow();
    },
  );
});
