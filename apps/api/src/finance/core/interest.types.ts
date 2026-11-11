/**
 * Ставка в долях единицы.
 * "0.04" = 4%; "0.07" = 7%.
 */
export type InterestRate = string;

/**
 * Как получить дневную ставку из месячной.
 */
export type MonthlyRateDivisor = 'CALENDAR_MONTH_DAYS' | 'FIXED_30_DAYS';

/**
 * Условия начисления по месячной ставке.
 */
export interface MonthlyInterestTerms {
  readonly kind: 'MONTHLY';

  readonly rate: InterestRate;

  readonly accrualBase: 'OUTSTANDING_PRINCIPAL';

  readonly dailyRateDivisor: MonthlyRateDivisor;
}
