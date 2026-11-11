import { describe, expect, it } from 'vitest';

import { accrueInterest, createInterestLedger } from './interest-ledger.js';

import { readInterestLedger } from './read-interest-ledger.js';
import { payInterest } from './pay-interest.js';
import { decimal } from './money.js';

describe('Накопитель процентов', () => {
  it('начинает с нулевых значений', () => {
    const ledger = createInterestLedger('HALF_UP');

    expect(readInterestLedger(ledger)).toEqual({
      accruedTotal: '0.00',
      paidTotal: '0.00',
      outstanding: '0.00',
    });
  });

  it('сохраняет дробные копейки между начислениями', () => {
    let ledger = createInterestLedger('HALF_UP');

    ledger = accrueInterest(ledger, decimal('0.004'));

    expect(readInterestLedger(ledger).accruedTotal).toBe('0.00');

    ledger = accrueInterest(ledger, decimal('0.004'));

    expect(readInterestLedger(ledger)).toEqual({
      accruedTotal: '0.01',
      paidTotal: '0.00',
      outstanding: '0.01',
    });
  });

  it('использует выбранный способ округления', () => {
    const halfUp = accrueInterest(
      createInterestLedger('HALF_UP'),
      decimal('0.005'),
    );

    const halfEven = accrueInterest(
      createInterestLedger('HALF_EVEN'),
      decimal('0.005'),
    );

    expect(readInterestLedger(halfUp).accruedTotal).toBe('0.01');

    expect(readInterestLedger(halfEven).accruedTotal).toBe('0.00');
  });

  it('разделяет начисленные и оплаченные проценты', () => {
    let ledger = createInterestLedger('HALF_UP');

    ledger = accrueInterest(ledger, decimal('20000'));
    ledger = payInterest(ledger, '15000.00');

    expect(readInterestLedger(ledger)).toEqual({
      accruedTotal: '20000.00',
      paidTotal: '15000.00',
      outstanding: '5000.00',
    });
  });

  it('не теряет дробный остаток после оплаты', () => {
    let ledger = createInterestLedger('HALF_UP');

    ledger = accrueInterest(ledger, decimal('0.008'));
    ledger = payInterest(ledger, '0.01');

    expect(readInterestLedger(ledger).outstanding).toBe('0.00');

    ledger = accrueInterest(ledger, decimal('0.004'));

    expect(readInterestLedger(ledger)).toEqual({
      accruedTotal: '0.01',
      paidTotal: '0.01',
      outstanding: '0.00',
    });

    ledger = accrueInterest(ledger, decimal('0.008'));

    expect(readInterestLedger(ledger)).toEqual({
      accruedTotal: '0.02',
      paidTotal: '0.01',
      outstanding: '0.01',
    });
  });

  it('запрещает оплату сверх остатка процентов', () => {
    const ledger = accrueInterest(
      createInterestLedger('HALF_UP'),
      decimal('100'),
    );

    expect(() => payInterest(ledger, '100.01')).toThrow('больше, чем осталось');
  });

  it('разрешает нулевое погашение процентов', () => {
    const ledger = createInterestLedger('HALF_UP');

    expect(readInterestLedger(payInterest(ledger, '0.00'))).toEqual(
      readInterestLedger(ledger),
    );
  });

  it('не изменяет прежнее состояние при начислении и оплате', () => {
    const original = accrueInterest(
      createInterestLedger('HALF_UP'),
      decimal('100'),
    );

    const updated = accrueInterest(original, decimal('50'));
    const paid = payInterest(updated, '20.00');

    expect(readInterestLedger(original)).toEqual({
      accruedTotal: '100.00',
      paidTotal: '0.00',
      outstanding: '100.00',
    });

    expect(readInterestLedger(paid)).toEqual({
      accruedTotal: '150.00',
      paidTotal: '20.00',
      outstanding: '130.00',
    });
  });

  it('отклоняет отрицательное начисление', () => {
    const ledger = createInterestLedger('HALF_UP');

    expect(() => accrueInterest(ledger, decimal('-1'))).toThrow(
      'неотрицательной',
    );
  });

  it('отклоняет бесконечное начисление', () => {
    const ledger = createInterestLedger('HALF_UP');

    expect(() => accrueInterest(ledger, decimal('1').div('0'))).toThrow(
      'конечной',
    );
  });
});
