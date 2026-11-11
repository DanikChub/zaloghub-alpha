import type { FinanceInstruction, LoanTerms } from './finance.types'
export type DealStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED'
export type PaymentType = 'INTEREST' | 'PRINCIPAL' | 'PENALTY' | 'OTHER'

export interface Borrower {
  id: string
  firstName: string
  lastName: string
  middleName: string | null
  phone: string | null
  email: string | null
}

export interface Collateral {
  id: string
  type: string
  address: string
  cadastralNumber: string | null
  estimatedValue: string | null
}

export interface Disbursement {
  id: string
  amount: string
  issuedAt: string
  comment: string | null
}

export interface Payment {
  id: string
  amount: string
  paidAt: string
  type: PaymentType
  comment: string | null
}

export interface Deal {
  financeTerms?: LoanTerms | null
  financeInstructions?: FinanceInstruction[]
  id: string
  contractNumber: string | null
  signedAt: string | null
  contractCity: string | null
  principalAmount: string
  preferentialRate: string
  standardRate: string
  moratoriumMonths: number
  termMonths: number
  penaltyRate: string
  increasedPenaltyRate: string
  paymentDay: number
  status: DealStatus
  borrowerId: string | null
  collateralId: string | null
  borrower: Borrower | null
  collateral: Collateral | null
  disbursements: Disbursement[]
  payments: Payment[]
  createdAt: string
}

export interface DealInput {
  contractNumber?: string
  signedAt?: string
  contractCity?: string
  borrowerId?: string
  collateralId?: string
  principalAmount: number
  preferentialRate: number
  standardRate: number
  moratoriumMonths: number
  termMonths: number
  penaltyRate: number
  increasedPenaltyRate: number
  paymentDay: number
  status: DealStatus
}

export interface DealSummary {
  dealCount: number
  issued: string
  principalReturned: string
  outstandingCapital: string
  interestReceived: string
  penaltiesReceived: string
}

export type DealFinance =
  | {
      status: 'CONFIGURATION_REQUIRED'
      message: string
    }
  | {
      status: 'READY'
      asOfOn: string
      principalOutstanding: string
      penaltyOutstanding: string
      interestOutstanding: string
      unappliedCredit: string
      snapshot: {
        dueNow: string
        overdueTotal: string
        daysPastDue: number
        nextPaymentOn: string | null
        nextPaymentAmount: string | null
        obligations: { key: string; component: 'PENALTY' | 'INTEREST' | 'PRINCIPAL' | 'EXPENSE' }[]
      }
      payments: {
        paymentId: string
        unallocatedAmount: string
        allocations: { obligationKey: string; amount: string }[]
      }[]
    }
