import type { FinancialEvent, LocalDate, Money } from '../finance.types.js';
import type { MonthlyInterestTerms } from '../interest.types.js';
import type { MoneyRounding } from '../money.js';
import type { InterestScheduleInput } from '../schedule/schedule.types.js';
import type {
  ObligationAllocation,
  ObligationSnapshot,
} from '../obligations/obligation.types.js';
import type { ReceiptAllocationPolicy } from '../obligations/receipt-allocation.types.js';
import type { LoanAction, ReceiptCredit } from './loan-action.types.js';

/** Отсутствующая дата внутри покрытия является нерабочей. */
export interface WorkingCalendar {
  readonly fromOn: LocalDate;
  readonly toOn: LocalDate;
  readonly workingDays: readonly LocalDate[];
}

export interface LoanTerms {
  readonly version: 1;
  readonly contractAmount: Money;
  readonly schedule: InterestScheduleInput;
  readonly interest: MonthlyInterestTerms;
  readonly roundingMode: MoneyRounding;
  readonly allocation: ReceiptAllocationPolicy;
  /** До этой даты досрочное погашение тела запрещено. */
  readonly principalRepaymentFromOn?: LocalDate;
  readonly calendarVersionIds?: readonly string[];
  readonly settlement?: {
    readonly minimumInterestRate: string;
    readonly minimumInterestMonths: number;
  };
  readonly penalty?: {
    readonly dailyRate: string;
    readonly base:
      'CONTRACT_AMOUNT' | 'OUTSTANDING_PRINCIPAL' | 'OVERDUE_BALANCE';
    readonly paymentDay: 'INCLUDED' | 'EXCLUDED';
    readonly increase?: {
      readonly afterMonths: number;
      readonly dailyRate: string;
      readonly retrospective: boolean;
    };
  };
  readonly rateLoss?: {
    readonly standardRate: string;
    readonly graceWorkingDays: number;
    readonly partialPaymentTriggers: boolean;
    readonly retrospective: 'DUE_MONTH';
    readonly calendar: WorkingCalendar;
  };
}

export interface LoanCalculationInput {
  readonly loanId: string;
  readonly currency: 'RUB';
  readonly asOfOn: LocalDate;
  readonly terms: LoanTerms;
  readonly events: readonly FinancialEvent[];
  readonly actions?: readonly LoanAction[];
}

export interface LoanAccrual {
  readonly effectiveOn: LocalDate;
  readonly obligationKey: string;
  readonly component: 'INTEREST' | 'PENALTY';
  readonly base: Money;
  readonly rate: string;
  readonly rawAmount: string;
  readonly amount: Money;
}

export interface LoanCalculationResult {
  readonly engineVersion: 'loan-v2';
  readonly loanId: string;
  readonly currency: 'RUB';
  readonly asOfOn: LocalDate;
  readonly disbursedTotal: Money;
  readonly receivedTotal: Money;
  readonly principalOutstanding: Money;
  readonly principalReturned: Money;
  readonly interestAccrued: Money;
  readonly interestOutstanding: Money;
  readonly interestPaid: Money;
  readonly prepaidInterest: Money;
  readonly penaltyAccrued: Money;
  readonly penaltyOutstanding: Money;
  readonly penaltyPaid: Money;
  readonly unappliedCredit: Money;
  readonly refundedTotal: Money;
  readonly availableCredit: Money;
  readonly reservedCredit: Money;
  readonly credits: readonly ReceiptCredit[];
  readonly creditReservations: readonly {
    instructionId: string;
    receiptId: string;
    obligationKey: string;
    amount: Money;
  }[];
  readonly settledOn: LocalDate | null;
  /** Фактический долг; будущие проценты сюда не входят. */
  readonly totalOutstanding: Money;
  readonly rateLossEffectiveOn: LocalDate | null;
  readonly snapshot: ObligationSnapshot;
  readonly allocations: readonly ObligationAllocation[];
  readonly accruals: readonly LoanAccrual[];
  readonly payments: readonly {
    paymentId: string;
    effectiveOn: LocalDate;
    amount: Money;
    allocatedAmount: Money;
    unallocatedAmount: Money;
    allocations: readonly ObligationAllocation[];
  }[];
  readonly forecastAssumption: 'CURRENT_PRINCIPAL_AND_RATE';
}
