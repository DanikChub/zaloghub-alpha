import { baseApi } from '../../../shared/api/baseApi'
import type { Borrower, Collateral, Deal, DealInput, DealSummary, Disbursement, Payment, PaymentType } from '../model/types'

export const dealsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDeals: builder.query<Deal[], void>({
      query: () => '/deals',
      providesTags: ['Deal'],
    }),
    getDeal: builder.query<Deal, string>({
      query: (id) => `/deals/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Deal', id }],
    }),
    getDealSummary: builder.query<DealSummary, void>({
      query: () => '/deals/summary',
      providesTags: ['Deal'],
    }),
    createDeal: builder.mutation<Deal, DealInput>({
      query: (body) => ({ url: '/deals', method: 'POST', body }),
      invalidatesTags: ['Deal'],
    }),
    updateDeal: builder.mutation<Deal, { id: string; body: Partial<DealInput> }>({
      query: ({ id, body }) => ({ url: `/deals/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Deal'],
    }),
    deleteDeal: builder.mutation<void, string>({
      query: (id) => ({ url: `/deals/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Deal'],
    }),
    getBorrowers: builder.query<Borrower[], void>({
      query: () => '/borrowers',
      providesTags: ['Deal'],
    }),
    createBorrower: builder.mutation<Borrower, { firstName: string; lastName: string; middleName?: string; phone?: string; email?: string }>({
      query: (body) => ({ url: '/borrowers', method: 'POST', body }),
      invalidatesTags: ['Deal'],
    }),
    getCollaterals: builder.query<Collateral[], void>({
      query: () => '/collaterals',
      providesTags: ['Deal'],
    }),
    createCollateral: builder.mutation<Collateral, { type: string; address: string; cadastralNumber?: string; estimatedValue?: number }>({
      query: (body) => ({ url: '/collaterals', method: 'POST', body }),
      invalidatesTags: ['Deal'],
    }),
    addDisbursement: builder.mutation<Disbursement, { dealId: string; amount: number; date: string; comment?: string }>({
      query: ({ dealId, ...body }) => ({ url: `/deals/${dealId}/disbursements`, method: 'POST', body }),
      invalidatesTags: ['Deal'],
    }),
    addPayment: builder.mutation<Payment, { dealId: string; amount: number; date: string; type: PaymentType; comment?: string }>({
      query: ({ dealId, ...body }) => ({ url: `/deals/${dealId}/payments`, method: 'POST', body }),
      invalidatesTags: ['Deal'],
    }),
    deletePayment: builder.mutation<void, { dealId: string; id: string }>({
      query: ({ dealId, id }) => ({ url: `/deals/${dealId}/payments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Deal'],
    }),
    deleteDisbursement: builder.mutation<void, { dealId: string; id: string }>({
      query: ({ dealId, id }) => ({ url: `/deals/${dealId}/disbursements/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Deal'],
    }),
  }),
})

export const {
  useGetDealsQuery, useGetDealQuery, useGetDealSummaryQuery,
  useCreateDealMutation, useUpdateDealMutation, useDeleteDealMutation,
  useGetBorrowersQuery, useCreateBorrowerMutation, useGetCollateralsQuery, useCreateCollateralMutation,
  useAddDisbursementMutation, useAddPaymentMutation, useDeletePaymentMutation, useDeleteDisbursementMutation,
} = dealsApi
