export type DebtComponent = 'PENALTY' | 'INTEREST' | 'PRINCIPAL' | 'EXPENSE'
export interface LoanTerms {
  version: 1
  contractAmount: string
  schedule: {
    accrualStartOn: string
    firstPaymentOn: string
    paymentDay: number
    maturityOn: string
    missingPaymentDay: 'LAST_DAY_OF_MONTH' | 'REJECT'
  }
  interest: {
    kind: 'MONTHLY'
    rate: string
    accrualBase: 'OUTSTANDING_PRINCIPAL'
    dailyRateDivisor: 'FIXED_30_DAYS' | 'CALENDAR_MONTH_DAYS'
  }
  roundingMode: 'HALF_UP' | 'HALF_EVEN' | 'DOWN'
  allocation: {
    priority: 'DUE_FIRST'
    componentOrder: DebtComponent[]
    earlyInterest: 'CURRENT_PERIOD' | 'NONE'
    earlyPrincipal: 'BLOCKED' | 'ALLOWED'
    unappliedFunds: 'HOLD'
  }
  principalRepaymentFromOn?: string
  calendarVersionIds?: string[]
  settlement?: { minimumInterestRate: string; minimumInterestMonths: number }
  penalty?: {
    dailyRate: string
    base: 'CONTRACT_AMOUNT' | 'OUTSTANDING_PRINCIPAL' | 'OVERDUE_BALANCE'
    paymentDay: 'INCLUDED' | 'EXCLUDED'
    increase?: { afterMonths: number; dailyRate: string; retrospective: boolean }
  }
  rateLoss?: {
    standardRate: string
    graceWorkingDays: number
    partialPaymentTriggers: boolean
    retrospective: 'DUE_MONTH'
    calendar?: { fromOn: string; toOn: string; workingDays: string[] }
  }
}
export interface TermsResponse {
  terms: LoanTerms | null
  suggestedTerms: LoanTerms | null
  description: string[]
  requiresConfirmation: boolean
  notes: string[]
}
export interface CalendarVersion {
  id: string
  year: number
  status: string
  sourceUrl: string
  importedAt: string
}
export interface ReceiptCredit {
  receiptId: string
  refundedAmount: string
  remainingAmount: string
  reservedForRefund: string
  reservedForFuture: string
  availableAmount: string
}
export interface CreditReservation {
  instructionId: string
  receiptId: string
  obligationKey: string
  amount: string
}
export interface CreditBalance {
  credits: ReceiptCredit[]
  creditReservations: CreditReservation[]
  availableCredit: string
  reservedCredit: string
  refundedTotal: string
  preferredAction: 'REFUND'
}
export interface CreditProposal {
  receiptId: string
  targets: { obligationKey: string; amount: string }[]
  amountToAllocate: string
  remainingForRefund: string
  requiresAgreement: boolean
}
export interface FinanceInstruction {
  id: string
  kind: 'REFUND' | 'CREDIT' | 'SETTLEMENT'
  status: 'AGREED' | 'EXECUTED' | 'CANCELLED'
  effectiveOn: string
  executedOn: string | null
  cancelledOn: string | null
  executionReference: string | null
  payload: {
    receiptId?: string
    amount?: string
    targets?: CreditProposal['targets']
    agreementReference?: string
    amountToClose?: string
    minimumInterestTotal?: string
    interestPaid?: string
  }
}
export interface SettlementQuote {
  on: string
  principal: string
  penalty: string
  interestPaid: string
  interestRemaining: string
  minimumInterestTotal: string
  interestTarget: string
  insideMoratorium: boolean
  releasedPrepaidInterest: string
  amountToClose: string
  availableForSettlement: string
  additionalPaymentRequired: string
  quoteHash: string
  requiresInvestorAgreement: boolean
  calculationMoment: 'END_OF_DAY'
}
