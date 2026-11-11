import { describe, expect, it } from 'vitest';

import type { FixedDailyPenaltyTerms } from './penalty.types.js';

import { calculatePenalty } from './calculate-penalty.js';

function terms(
  changes: Partial<FixedDailyPenaltyTerms> = {},
): FixedDailyPenaltyTerms {
  return {
    kind: 'FIXED_DAILY',
    baseAmount: '815317.31',
    dailyRate: '0.015',
    fromOn: '2025-12-26',
    toOnExclusive: null,
    roundingMode: 'HALF_UP',
    ...changes,
  };
}

describe('Пени на фиксированную базу', () => {
  it('воспроизводит судебный эталон за 188 дней', () => {
    expect(calculatePenalty(terms(), '2026-07-01')).toBe('2299194.81');
  });

  it('не начисляет до начала периода', () => {
    expect(calculatePenalty(terms(), '2025-12-25')).toBe('0.00');
  });

  it('включает первый день периода', () => {
    expect(calculatePenalty(terms(), '2025-12-26')).toBe('12229.76');
  });

  it('останавливается на исключённой правой границе', () => {
    expect(
      calculatePenalty(
        terms({
          toOnExclusive: '2025-12-27',
        }),
        '2026-07-01',
      ),
    ).toBe('12229.76');
  });

  it('округляет итог периода, не каждый день', () => {
    expect(
      calculatePenalty(
        terms({
          baseAmount: '1.00',
          dailyRate: '0.005',
          fromOn: '2026-01-01',
        }),
        '2026-01-03',
      ),
    ).toBe('0.02');
  });

  it('поддерживает нулевую ставку', () => {
    expect(calculatePenalty(terms({ dailyRate: '0' }), '2026-07-01')).toBe(
      '0.00',
    );
  });

  it('отклоняет отрицательную ставку', () => {
    expect(() =>
      calculatePenalty(terms({ dailyRate: '-0.015' }), '2026-07-01'),
    ).toThrow();
  });

  it('отклоняет отрицательную базу', () => {
    expect(() =>
      calculatePenalty(terms({ baseAmount: '-1.00' }), '2026-07-01'),
    ).toThrow();
  });

  it('отклоняет обратный период', () => {
    expect(() =>
      calculatePenalty(terms({ toOnExclusive: '2025-12-25' }), '2026-07-01'),
    ).toThrow();
  });
});
