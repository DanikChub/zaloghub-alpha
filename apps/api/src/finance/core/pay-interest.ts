import type { Money } from './finance.types.js';
import type { InterestLedger } from './interest-ledger.types.js';

import { decimal } from './money.js';
import { validateMoney } from './validate-money.js';
import { readInterestLedger } from './read-interest-ledger.js';

export function payInterest(
  ledger: InterestLedger,
  amount: Money,
): InterestLedger {
  validateMoney(amount, true);

  const payment = decimal(amount);
  const balance = readInterestLedger(ledger);

  if (payment.greaterThan(balance.outstanding)) {
    throw new Error('Нельзя погасить процентов больше, чем осталось');
  }

  return {
    ...ledger,
    paid: ledger.paid.plus(payment),
  };
}
