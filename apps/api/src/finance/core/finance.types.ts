/**
 * Денежная сумма в виде десятичной строки.
 * Пример: "650000.00".
 */
export type Money = string;

/**
 * Календарная дата в формате YYYY-MM-DD.
 * Пример: "2026-11-05".
 */
export type LocalDate = string;

interface FinancialEventBase {
  /** Уникальный идентификатор события. */
  readonly id: string;

  /** Дата, с которой событие влияет на расчёт. */
  readonly effectiveOn: LocalDate;

  /** Порядок событий внутри одной даты. */
  readonly sequenceNo: number;

  /** Положительная сумма в валюте рассчитываемого займа. */
  readonly amount: Money;
}

/** Фактически выданная часть займа. */
export interface DisbursementEvent extends FinancialEventBase {
  readonly kind: 'DISBURSEMENT';
}

/** Фактически полученный платёж. */
export interface ReceiptEvent extends FinancialEventBase {
  readonly kind: 'RECEIPT';
}

export type FinancialEvent =
  | DisbursementEvent
  | ReceiptEvent;