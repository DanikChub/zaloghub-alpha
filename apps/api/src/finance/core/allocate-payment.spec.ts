import { describe, expect, it } from 'vitest';

import type { PaymentAllocationInput } from './payment-allocation.types.js';

import { allocatePayment } from './allocate-payment.js';
import { decimal } from './money.js';

function input(
  changes: Partial<PaymentAllocationInput> = {},
): PaymentAllocationInput {
  return {
    amount: '30000.00',
    principalToPay: '650000.00',
    interestToPay: '20000.00',
    order: 'INTEREST_THEN_PRINCIPAL',
    ...changes,
  };
}

describe('Распределение платежа', () => {
  it('сначала погашает проценты, затем тело', () => {
    expect(allocatePayment(input())).toEqual({
      principalPaid: '10000.00',
      interestPaid: '20000.00',
      unallocatedAmount: '0.00',
      principalRemaining: '640000.00',
      interestRemaining: '0.00',
    });
  });

  it('поддерживает погашение тела перед процентами', () => {
    expect(
      allocatePayment(
        input({
          order: 'PRINCIPAL_THEN_INTEREST',
        }),
      ),
    ).toEqual({
      principalPaid: '30000.00',
      interestPaid: '0.00',
      unallocatedAmount: '0.00',
      principalRemaining: '620000.00',
      interestRemaining: '20000.00',
    });
  });

  it('частично погашает проценты при недостаточном платеже', () => {
    expect(
      allocatePayment(
        input({
          amount: '5000.00',
        }),
      ),
    ).toEqual({
      principalPaid: '0.00',
      interestPaid: '5000.00',
      unallocatedAmount: '0.00',
      principalRemaining: '650000.00',
      interestRemaining: '15000.00',
    });
  });

  it('оставляет переплату нераспределённой', () => {
    expect(
      allocatePayment(
        input({
          amount: '700000.00',
        }),
      ),
    ).toEqual({
      principalPaid: '650000.00',
      interestPaid: '20000.00',
      unallocatedAmount: '30000.00',
      principalRemaining: '0.00',
      interestRemaining: '0.00',
    });
  });

  it('не направляет деньги в тело, если его нельзя погашать', () => {
    expect(
      allocatePayment(
        input({
          principalToPay: '0.00',
        }),
      ),
    ).toEqual({
      principalPaid: '0.00',
      interestPaid: '20000.00',
      unallocatedAmount: '10000.00',
      principalRemaining: '0.00',
      interestRemaining: '0.00',
    });
  });

  it('точно распределяет копейки', () => {
    expect(
      allocatePayment(
        input({
          amount: '0.03',
          principalToPay: '0.02',
          interestToPay: '0.02',
        }),
      ),
    ).toEqual({
      principalPaid: '0.01',
      interestPaid: '0.02',
      unallocatedAmount: '0.00',
      principalRemaining: '0.01',
      interestRemaining: '0.00',
    });
  });

  it.each([
    input(),
    input({ amount: '5000.00' }),
    input({ amount: '700000.00' }),
    input({ order: 'PRINCIPAL_THEN_INTEREST' }),
  ])('сохраняет деньги и остатки: %j', (source) => {
    const result = allocatePayment(source);

    const distributed = decimal(result.principalPaid)
      .plus(result.interestPaid)
      .plus(result.unallocatedAmount);

    expect(distributed.equals(source.amount)).toBe(true);

    expect(
      decimal(result.principalPaid)
        .plus(result.principalRemaining)
        .equals(source.principalToPay),
    ).toBe(true);

    expect(
      decimal(result.interestPaid)
        .plus(result.interestRemaining)
        .equals(source.interestToPay),
    ).toBe(true);
  });

  it('не изменяет входные данные', () => {
    const source = input();
    const original = structuredClone(source);

    allocatePayment(source);

    expect(source).toEqual(original);
  });

  it.each([
    input({ amount: '0.00' }),
    input({ amount: '-1.00' }),
    input({ principalToPay: '-1.00' }),
    input({ interestToPay: '1.001' }),
  ])('отклоняет некорректные суммы: %j', (source) => {
    expect(() => allocatePayment(source)).toThrow();
  });

  it('отклоняет неизвестную очередность', () => {
    const source = {
      ...input(),
      order: 'UNKNOWN',
    };

    expect(() => allocatePayment(source as PaymentAllocationInput)).toThrow(
      'Неподдерживаемая очередность',
    );
  });
});
