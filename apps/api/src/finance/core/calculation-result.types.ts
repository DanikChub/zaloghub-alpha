import type { LocalDate, Money } from './finance.types.js';

export interface FinanceCalculationResult {
  readonly loanId: string;
  readonly currency: string;
  readonly asOfOn: LocalDate;

  /** Всего фактически выдано. */
  readonly disbursedTotal: Money;

  /** Всего поступило от плательщиков. */
  readonly receivedTotal: Money;

  /** Непогашенный основной долг. */
  readonly principalOutstanding: Money;

  /** Всего начислено процентов за рассчитанный период. */
  readonly interestAccrued: Money;

  /** Начисленные, но ещё не оплаченные проценты. */
  readonly interestOutstanding: Money;

  /** Поступления, оставшиеся после погашения обязательств. */
  readonly unappliedCredit: Money;

  /** Основной долг плюс неоплаченные проценты. */
  readonly totalOutstanding: Money;

  /** Всего начислено пеней. */
  readonly penaltyAccrued: Money;

  /** Начисленные, но ещё не погашенные пени. */
  readonly penaltyOutstanding: Money;
}
