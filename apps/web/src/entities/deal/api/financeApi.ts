import { baseApi } from '../../../shared/api/baseApi'
import type { DealFinance } from '../model/types'
import type {
  CalendarVersion,
  CreditBalance,
  CreditProposal,
  FinanceInstruction,
  LoanTerms,
  SettlementQuote,
  TermsResponse,
} from '../model/finance.types'

interface DealRequest {
  dealId: string
}
interface DatedRequest extends DealRequest {
  date: string
}
interface InstructionRequest extends DatedRequest {
  instructionId: string
}
export interface FinanceTermsPreview {
  terms: LoanTerms
  description: string[]
  confirmationHash: string
  finance: DealFinance
}
export const financeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFinanceTerms: builder.query<TermsResponse, string>({
      query: (id) => `/deals/${id}/finance/terms`,
      providesTags: ['Deal'],
    }),
    previewFinanceTerms: builder.mutation<FinanceTermsPreview, DealRequest & { terms: LoanTerms }>({
      query: ({ dealId, ...body }) => ({ url: `/deals/${dealId}/finance/terms/preview`, method: 'POST', body }),
      invalidatesTags: ['Calendar'],
    }),
    saveFinanceTerms: builder.mutation<unknown, DealRequest & { terms: LoanTerms; confirmationHash: string }>({
      query: ({ dealId, ...body }) => ({ url: `/deals/${dealId}/finance/terms`, method: 'PUT', body }),
      invalidatesTags: ['Deal'],
    }),
    getRussianCalendars: builder.query<CalendarVersion[], void>({
      query: () => '/finance/calendars/ru',
      providesTags: ['Calendar'],
    }),
    importRussianCalendar: builder.mutation<CalendarVersion, { year: number; refresh: boolean }>({
      query: (body) => ({ url: '/finance/calendars/ru/import', method: 'POST', body }),
      invalidatesTags: ['Calendar'],
    }),
    extendDealCalendar: builder.mutation<unknown, DealRequest & { asOfOn: string }>({
      query: ({ dealId, ...body }) => ({ url: `/deals/${dealId}/finance/terms/calendar/extend`, method: 'POST', body }),
      invalidatesTags: ['Deal', 'Calendar'],
    }),
    getCreditBalance: builder.query<CreditBalance, string>({
      query: (id) => `/deals/${id}/finance/credits`,
      providesTags: ['Deal'],
    }),
    requestCreditRefund: builder.mutation<
      FinanceInstruction,
      DatedRequest & { receiptId: string; amount: string; idempotencyKey: string; comment?: string }
    >({
      query: ({ dealId, ...body }) => ({ url: `/deals/${dealId}/finance/credits/refunds`, method: 'POST', body }),
      invalidatesTags: ['Deal'],
    }),
    confirmCreditRefund: builder.mutation<unknown, InstructionRequest & { transferReference: string }>({
      query: ({ dealId, instructionId, ...body }) => ({
        url: `/deals/${dealId}/finance/credits/refunds/${instructionId}/confirm`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Deal'],
    }),
    cancelCreditInstruction: builder.mutation<unknown, InstructionRequest & { kind: 'REFUND' | 'CREDIT' }>({
      query: ({ dealId, instructionId, kind, ...body }) => ({
        url: `/deals/${dealId}/finance/credits/${kind === 'REFUND' ? 'refunds' : 'agreements'}/${instructionId}/cancel`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Deal'],
    }),
    previewCredit: builder.mutation<CreditProposal, DatedRequest & { receiptId: string; amount: string }>({
      query: ({ dealId, ...body }) => ({ url: `/deals/${dealId}/finance/credits/preview`, method: 'POST', body }),
    }),
    agreeCredit: builder.mutation<
      FinanceInstruction,
      DatedRequest & {
        receiptId: string
        targets: CreditProposal['targets']
        idempotencyKey: string
        agreementReference: string
      }
    >({
      query: ({ dealId, ...body }) => ({ url: `/deals/${dealId}/finance/credits/agreements`, method: 'POST', body }),
      invalidatesTags: ['Deal'],
    }),
    calculateSettlement: builder.mutation<SettlementQuote, DatedRequest>({
      query: ({ dealId, date }) => ({ url: `/deals/${dealId}/finance/settlements/quote`, params: { date } }),
    }),
    agreeSettlement: builder.mutation<
      FinanceInstruction,
      DatedRequest & { quoteHash: string; idempotencyKey: string; agreementReference: string }
    >({
      query: ({ dealId, ...body }) => ({ url: `/deals/${dealId}/finance/settlements`, method: 'POST', body }),
      invalidatesTags: ['Deal'],
    }),
    executeSettlement: builder.mutation<unknown, InstructionRequest>({
      query: ({ dealId, instructionId, ...body }) => ({
        url: `/deals/${dealId}/finance/settlements/${instructionId}/execute`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Deal'],
    }),
    cancelSettlement: builder.mutation<unknown, InstructionRequest>({
      query: ({ dealId, instructionId, ...body }) => ({
        url: `/deals/${dealId}/finance/settlements/${instructionId}/cancel`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Deal'],
    }),
  }),
})
export const {
  useGetFinanceTermsQuery,
  usePreviewFinanceTermsMutation,
  useSaveFinanceTermsMutation,
  useGetRussianCalendarsQuery,
  useImportRussianCalendarMutation,
  useExtendDealCalendarMutation,
  useGetCreditBalanceQuery,
  useRequestCreditRefundMutation,
  useConfirmCreditRefundMutation,
  useCancelCreditInstructionMutation,
  usePreviewCreditMutation,
  useAgreeCreditMutation,
  useCalculateSettlementMutation,
  useAgreeSettlementMutation,
  useExecuteSettlementMutation,
  useCancelSettlementMutation,
} = financeApi
