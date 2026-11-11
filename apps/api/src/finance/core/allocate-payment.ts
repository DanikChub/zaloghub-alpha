import type {
  PaymentAllocationInput,
  PaymentAllocationResult,
} from './payment-allocation.types.js';

import { decimal } from './money.js';
import { validateMoney } from './validate-money.js';

export function allocatePayment(
  input: PaymentAllocationInput,
): PaymentAllocationResult {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Данные распределения должны быть объектом');
  }

  validateMoney(input.amount, false);
  validateMoney(input.principalToPay, true);
  validateMoney(input.interestToPay, true);

  if (
    input.order !== 'INTEREST_THEN_PRINCIPAL' &&
    input.order !== 'PRINCIPAL_THEN_INTEREST'
  ) {
    throw new Error('Неподдерживаемая очередность погашения');
  }

  const balances = {
    interest: decimal(input.interestToPay),
    principal: decimal(input.principalToPay),
  };

  const paid = {
    interest: decimal('0'),
    principal: decimal('0'),
  };

  let remaining = decimal(input.amount);

  const order =
    input.order === 'INTEREST_THEN_PRINCIPAL'
      ? (['interest', 'principal'] as const)
      : (['principal', 'interest'] as const);

  for (const component of order) {
    const portion = remaining.lessThan(balances[component])
      ? remaining
      : balances[component];

    paid[component] = portion;
    balances[component] = balances[component].minus(portion);
    remaining = remaining.minus(portion);
  }

  return {
    principalPaid: paid.principal.toFixed(2),
    interestPaid: paid.interest.toFixed(2),
    unallocatedAmount: remaining.toFixed(2),
    principalRemaining: balances.principal.toFixed(2),
    interestRemaining: balances.interest.toFixed(2),
  };
}
