import { describe, expect, it } from 'vitest';

import type { ReceiptEvent } from '../finance.types.js';

import type {
  PaymentObligation,
  ObligationAllocation,
} from './obligation.types.js';

import type { ReceiptAllocationPolicy } from './receipt-allocation.types.js';

import { allocateReceipt } from './allocate-receipt.js';
import { decimal } from '../money.js';

const policy: ReceiptAllocationPolicy = {
  priority: 'DUE_FIRST',

  componentOrder: ['PENALTY', 'INTEREST', 'PRINCIPAL', 'EXPENSE'],

  earlyInterest: 'CURRENT_PERIOD',
  earlyPrincipal: 'BLOCKED',
  unappliedFunds: 'HOLD',
};

function obligation(
  changes: Partial<PaymentObligation> = {},
): PaymentObligation {
  return {
    key: 'interest',
    component: 'INTEREST',
    dueOn: '2026-11-25',
    amount: '30000.00',

    periodFromOn: '2026-11-01',
    periodToOnExclusive: '2026-11-25',

    ...changes,
  };
}

function receipt(changes: Partial<ReceiptEvent> = {}): ReceiptEvent {
  return {
    id: 'receipt-1',
    kind: 'RECEIPT',
    effectiveOn: '2026-11-28',
    sequenceNo: 1,
    amount: '26000.00',
    ...changes,
  };
}

describe('Автораспределение одного поступления', () => {
  it('направляет деньги сначала в пени, затем в проценты', () => {
    const penalty = obligation({
      key: 'penalty',
      component: 'PENALTY',
      amount: '1000.00',
      dueOn: '2026-11-28',
      periodFromOn: null,
      periodToOnExclusive: null,
    });

    const result = allocateReceipt({
      receipt: receipt(),
      obligations: [obligation(), penalty],
      previousAllocations: [],
      policy,
    });

    expect(
      result.allocations.map((row) => [row.obligationKey, row.amount]),
    ).toEqual([
      ['penalty', '1000.00'],
      ['interest', '25000.00'],
    ]);

    expect(result.unallocatedAmount).toBe('0.00');
  });

  it('оставляет недоплату внутри процентного обязательства', () => {
    const result = allocateReceipt({
      receipt: receipt(),
      obligations: [obligation()],
      previousAllocations: [],
      policy,
    });

    expect(result.allocations[0].amount).toBe('26000.00');
  });

  it('принимает ранний платёж в текущий процентный период', () => {
    const result = allocateReceipt({
      receipt: receipt({
        effectiveOn: '2026-11-20',
      }),
      obligations: [obligation()],
      previousAllocations: [],
      policy,
    });

    expect(result.allocatedAmount).toBe('26000.00');
  });

  it('не оплачивает ещё не начавшийся процентный период', () => {
    const future = obligation({
      key: 'future',
      dueOn: '2026-12-25',
      amount: '4000.00',
      periodFromOn: '2026-11-25',
      periodToOnExclusive: '2026-12-25',
    });

    const result = allocateReceipt({
      receipt: receipt({
        effectiveOn: '2026-11-20',
        amount: '35000.00',
      }),
      obligations: [obligation(), future],
      previousAllocations: [],
      policy,
    });

    expect(result.allocatedAmount).toBe('30000.00');
    expect(result.unallocatedAmount).toBe('5000.00');
  });

  it('позволяет запретить раннюю оплату процентов', () => {
    const result = allocateReceipt({
      receipt: receipt({
        effectiveOn: '2026-11-20',
      }),
      obligations: [obligation()],
      previousAllocations: [],

      policy: {
        ...policy,
        earlyInterest: 'NONE',
      },
    });

    expect(result.unallocatedAmount).toBe('26000.00');
  });

  it('не погашает будущее тело при запрете досрочного возврата', () => {
    const principal = obligation({
      key: 'principal',
      component: 'PRINCIPAL',
      dueOn: '2027-11-25',
      amount: '100000.00',
      periodFromOn: null,
      periodToOnExclusive: null,
    });

    const result = allocateReceipt({
      receipt: receipt(),
      obligations: [principal],
      previousAllocations: [],
      policy,
    });

    expect(result.allocations).toEqual([]);
    expect(result.unallocatedAmount).toBe('26000.00');
  });

  it('разрешает досрочный возврат тела по переданному правилу', () => {
    const principal = obligation({
      key: 'principal',
      component: 'PRINCIPAL',
      dueOn: '2027-11-25',
      amount: '100000.00',
      periodFromOn: null,
      periodToOnExclusive: null,
    });

    const result = allocateReceipt({
      receipt: receipt(),
      obligations: [principal],
      previousAllocations: [],

      policy: {
        ...policy,
        earlyPrincipal: 'ALLOWED',
      },
    });

    expect(result.allocations[0].obligationKey).toBe('principal');
  });

  it('погашает наступившее тело раньше предоплаты будущих процентов', () => {
    const principal = obligation({
      key: 'principal',
      component: 'PRINCIPAL',
      dueOn: '2026-11-25',
      periodFromOn: null,
      periodToOnExclusive: null,
    });

    const future = obligation({
      key: 'future',
      dueOn: '2026-12-25',
      periodFromOn: '2026-11-25',
      periodToOnExclusive: '2026-12-25',
    });

    const result = allocateReceipt({
      receipt: receipt(),
      obligations: [future, principal],
      previousAllocations: [],
      policy,
    });

    expect(result.allocations[0].obligationKey).toBe('principal');
  });

  it('внутри компонента сначала гасит старое обязательство', () => {
    const old = obligation({
      key: 'old',
      dueOn: '2026-10-25',
      amount: '1000.00',
    });

    const current = obligation({
      amount: '2000.00',
    });

    const result = allocateReceipt({
      receipt: receipt({ amount: '1500.00' }),
      obligations: [current, old],
      previousAllocations: [],
      policy,
    });

    expect(
      result.allocations.map((row) => [row.obligationKey, row.amount]),
    ).toEqual([
      ['old', '1000.00'],
      ['interest', '500.00'],
    ]);
  });

  it('учитывает ранее распределённые деньги', () => {
    const rows: ObligationAllocation[] = [
      {
        id: 'old-allocation',
        paymentId: 'old-receipt',
        obligationKey: 'interest',
        effectiveOn: '2026-11-20',
        orderNo: 1,
        amount: '26000.00',
      },
    ];

    const result = allocateReceipt({
      receipt: receipt({ amount: '10000.00' }),
      obligations: [obligation()],
      previousAllocations: rows,
      policy,
    });

    expect(result.allocatedAmount).toBe('4000.00');
    expect(result.unallocatedAmount).toBe('6000.00');
  });

  it('не позволяет повторно распределить то же поступление', () => {
    const rows: ObligationAllocation[] = [
      {
        id: 'old-allocation',
        paymentId: 'receipt-1',
        obligationKey: 'interest',
        effectiveOn: '2026-11-20',
        orderNo: 1,
        amount: '100.00',
      },
    ];

    expect(() =>
      allocateReceipt({
        receipt: receipt(),
        obligations: [obligation()],
        previousAllocations: rows,
        policy,
      }),
    ).toThrow('уже распределено');
  });

  it('требует полного пересчёта для платежа задним числом', () => {
    const rows: ObligationAllocation[] = [
      {
        id: 'future-allocation',
        paymentId: 'future-receipt',
        obligationKey: 'interest',
        effectiveOn: '2026-11-29',
        orderNo: 1,
        amount: '100.00',
      },
    ];

    expect(() =>
      allocateReceipt({
        receipt: receipt(),
        obligations: [obligation()],
        previousAllocations: rows,
        policy,
      }),
    ).toThrow('задним числом');
  });

  it('сохраняет всю сумму поступления', () => {
    const source = receipt({
      amount: '40000.01',
    });

    const result = allocateReceipt({
      receipt: source,
      obligations: [obligation()],
      previousAllocations: [],
      policy,
    });

    const paid = result.allocations.reduce(
      (sum, row) => sum.plus(row.amount),
      decimal('0'),
    );

    expect(paid.plus(result.unallocatedAmount).equals(source.amount)).toBe(
      true,
    );
  });

  it('не допускает пропущенного компонента в очереди', () => {
    expect(() =>
      allocateReceipt({
        receipt: receipt(),
        obligations: [obligation()],
        previousAllocations: [],

        policy: {
          ...policy,
          componentOrder: ['INTEREST', 'PRINCIPAL', 'EXPENSE'],
        },
      }),
    ).toThrow('все компоненты');
  });

  it('не меняет входные данные', () => {
    const source = {
      receipt: receipt(),
      obligations: [obligation()],
      previousAllocations: [],
      policy,
    };

    const original = structuredClone(source);

    allocateReceipt(source);

    expect(source).toEqual(original);
  });
});
