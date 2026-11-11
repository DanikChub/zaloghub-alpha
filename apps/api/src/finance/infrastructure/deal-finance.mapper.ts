import { BadRequestException } from '@nestjs/common';
import type { FinancialEvent } from '../core/finance.types.js';
import type { LoanAction } from '../core/loan/loan-action.types.js';
import type { LoanCalculationInput } from '../core/loan/loan.types.js';
import type { LoanTerms } from '../core/loan/loan.types.js';
import { calculateLoan } from '../core/loan/calculate-loan.js';
import { addMonthsClamped } from '../core/loan/loan-dates.js';
import { nextMonthlyPaymentDate } from '../core/schedule/monthly-payment-date.js';
import { decimal } from '../core/money.js';

interface Operation {
  id: string;
  amount: { toString(): string };
  createdAt: Date;
  voidedAt?: Date | null;
}

export interface FinanceDeal {
  id: string;
  financeInstructions?: readonly {
    id: string;
    kind: string;
    status: string;
    effectiveOn: Date;
    executedOn: Date | null;
    cancelledOn: Date | null;
    payload: unknown;
    createdAt: Date;
  }[];
  financeTerms: unknown;
  principalAmount: { toString(): string };
  preferentialRate: { toString(): string };
  penaltyRate: { toString(): string };
  termMonths: number;
  paymentDay: number;
  moratoriumMonths: number;
  signedAt: Date | null;
  disbursements: readonly (Operation & { issuedAt: Date })[];
  payments: readonly (Operation & { paidAt: Date })[];
}

/** SQL DateTime legacy-полей хранит календарные даты как UTC midnight. */
export function operationDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Дата расчёта по умолчанию соответствует часовому поясу кабинета. */
export function financeToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function normalizeDealEvents(deal: FinanceDeal): FinancialEvent[] {
  const rows = [
    ...deal.disbursements
      .filter((o) => !o.voidedAt)
      .map((o) => ({
        ...o,
        effectiveOn: operationDate(o.issuedAt),
        kind: 'DISBURSEMENT' as const,
      })),
    ...deal.payments
      .filter((o) => !o.voidedAt)
      .map((o) => ({
        ...o,
        effectiveOn: operationDate(o.paidAt),
        kind: 'RECEIPT' as const,
      })),
  ].sort(
    (a, b) =>
      a.effectiveOn.localeCompare(b.effectiveOn) ||
      // Выдачи перед поступлениями одной даты; внутри вида — порядок регистрации.
      (a.kind === b.kind ? 0 : a.kind === 'DISBURSEMENT' ? -1 : 1) ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  return rows.map((row, index) => ({
    id: row.id,
    kind: row.kind,
    effectiveOn: row.effectiveOn,
    sequenceNo: index + 1,
    amount: row.amount.toString(),
  }));
}

export function normalizeLoanActions(deal: FinanceDeal): LoanAction[] {
  const actions: { action: Omit<LoanAction, 'sequenceNo'>; createdAt: Date }[] =
    [];
  for (const row of deal.financeInstructions ?? []) {
    const payload = row.payload as {
      receiptId: string;
      amount: string;
      targets: { obligationKey: string; amount: string }[];
    };
    const base = { id: row.id, effectiveOn: operationDate(row.effectiveOn) };
    if (row.kind === 'REFUND') {
      actions.push({
        action: {
          ...base,
          kind: 'REFUND_REQUEST',
          receiptId: payload.receiptId,
          amount: payload.amount,
        } as Omit<LoanAction, 'sequenceNo'>,
        createdAt: row.createdAt,
      });
      if (row.executedOn)
        actions.push({
          action: {
            id: row.id + ':executed',
            effectiveOn: operationDate(row.executedOn),
            kind: 'REFUND',
            instructionId: row.id,
          } as Omit<LoanAction, 'sequenceNo'>,
          createdAt: row.createdAt,
        });
      if (row.cancelledOn)
        actions.push({
          action: {
            id: row.id + ':cancelled',
            effectiveOn: operationDate(row.cancelledOn),
            kind: 'CANCEL_REFUND',
            instructionId: row.id,
          } as Omit<LoanAction, 'sequenceNo'>,
          createdAt: row.createdAt,
        });
    } else if (row.kind === 'CREDIT') {
      actions.push({
        action: {
          ...base,
          kind: 'CREDIT',
          receiptId: payload.receiptId,
          targets: payload.targets,
        } as Omit<LoanAction, 'sequenceNo'>,
        createdAt: row.createdAt,
      });
      if (row.cancelledOn)
        actions.push({
          action: {
            id: row.id + ':cancelled',
            effectiveOn: operationDate(row.cancelledOn),
            kind: 'CANCEL_CREDIT',
            instructionId: row.id,
          } as Omit<LoanAction, 'sequenceNo'>,
          createdAt: row.createdAt,
        });
    } else if (row.kind === 'SETTLEMENT' && row.executedOn)
      actions.push({
        action: {
          ...base,
          effectiveOn: operationDate(row.executedOn),
          kind: 'SETTLEMENT',
        },
        createdAt: row.createdAt,
      });
  }
  return actions
    .sort(
      (a, b) =>
        a.action.effectiveOn.localeCompare(b.action.effectiveOn) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .map(
      (entry, index) =>
        ({ ...entry.action, sequenceNo: index + 1 }) as LoanAction,
    );
}

export function toLoanInput(
  deal: FinanceDeal,
  asOfOn = financeToday(),
): LoanCalculationInput {
  return {
    loanId: deal.id,
    currency: 'RUB',
    asOfOn,
    terms: deal.financeTerms as LoanTerms,
    events: normalizeDealEvents(deal),
    actions: normalizeLoanActions(deal),
  };
}

export function calculateDealFinance(
  deal: FinanceDeal,
  asOfOn = financeToday(),
) {
  if (deal.financeTerms === null || deal.financeTerms === undefined) {
    return {
      status: 'CONFIGURATION_REQUIRED' as const,
      message:
        'Подтвердите финансовые условия договора через PUT /deals/:id/finance/terms',
    };
  }
  try {
    return {
      status: 'READY' as const,
      ...calculateLoan(toLoanInput(deal, asOfOn)),
    };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    throw new BadRequestException({
      code: 'FINANCE_INPUT_INVALID',
      message: error.message,
    });
  }
}

/** Заготовка для проверки человеком. Утрату льготы нельзя включать без календаря. */
export function suggestDealTerms(deal: FinanceDeal): LoanTerms | null {
  const first = normalizeDealEvents(deal).find(
    (e) => e.kind === 'DISBURSEMENT',
  );
  if (!first) return null;
  const maturityOn = addMonthsClamped(
    deal.signedAt ? operationDate(deal.signedAt) : first.effectiveOn,
    deal.termMonths,
  );
  return {
    version: 1,
    contractAmount: deal.principalAmount.toString(),
    schedule: {
      accrualStartOn: first.effectiveOn,
      firstPaymentOn: nextMonthlyPaymentDate(
        first.effectiveOn,
        deal.paymentDay,
        'LAST_DAY_OF_MONTH',
      ),
      paymentDay: deal.paymentDay,
      maturityOn,
      missingPaymentDay: 'LAST_DAY_OF_MONTH',
    },
    interest: {
      kind: 'MONTHLY',
      rate: decimal(deal.preferentialRate.toString()).div(100).toFixed(),
      accrualBase: 'OUTSTANDING_PRINCIPAL',
      dailyRateDivisor: 'FIXED_30_DAYS',
    },
    roundingMode: 'HALF_UP',
    allocation: {
      priority: 'DUE_FIRST',
      componentOrder: ['PENALTY', 'INTEREST', 'PRINCIPAL', 'EXPENSE'],
      earlyInterest: 'CURRENT_PERIOD',
      earlyPrincipal: 'BLOCKED',
      unappliedFunds: 'HOLD',
    },
    principalRepaymentFromOn: addMonthsClamped(
      first.effectiveOn,
      deal.moratoriumMonths,
    ),
    settlement: {
      minimumInterestRate: decimal(deal.preferentialRate.toString())
        .div(100)
        .toFixed(),
      minimumInterestMonths: Math.max(1, deal.moratoriumMonths),
    },
    penalty: {
      dailyRate: decimal(deal.penaltyRate.toString()).div(100).toFixed(),
      base: 'CONTRACT_AMOUNT',
      paymentDay: 'INCLUDED',
    },
  };
}
