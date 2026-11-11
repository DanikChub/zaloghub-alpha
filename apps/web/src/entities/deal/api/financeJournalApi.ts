import { baseApi } from '../../../shared/api/baseApi'
import type { LoanTerms } from '../model/finance.types'

export interface JournalVersionSummary {
    id: string
    dealId: string
    asOfOn: string
    recordedAt: string
    engineVersion: string
    schemaVersion: number
    contentHash: string
}

export interface JournalAccrual {
    effectiveOn: string
    obligationKey: string
    component: 'INTEREST' | 'PENALTY'
    base: string
    rate: string
    rawAmount: string
    amount: string
}

export interface JournalObligation {
    key: string
    component: 'PRINCIPAL' | 'INTEREST' | 'PENALTY' | 'EXPENSE'
    dueOn: string
    amount: string
    paidAmount: string
    remainingAmount: string
    periodFromOn: string | null
    periodToOnExclusive: string | null
    status: string
}

export interface JournalVersion extends JournalVersionSummary {
    payload: {
        schemaVersion: number
        input: {
            terms: LoanTerms
        }
        result: {
            asOfOn: string
            principalOutstanding: string
            interestAccrued: string
            interestOutstanding: string
            penaltyAccrued: string
            penaltyOutstanding: string
            totalOutstanding: string
            rateLossEffectiveOn: string | null
            accruals: JournalAccrual[]
            allocations: {
                id: string
                paymentId: string
                obligationKey: string
                effectiveOn: string
                amount: string
            }[]
            snapshot: {
                obligations: JournalObligation[]
            }
        }
    }
}

export const financeJournalApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getJournalVersions: builder.query<JournalVersionSummary[], string>({
            query: (dealId) => `/deals/${dealId}/finance/journal/versions`,
            providesTags: ['Deal'],
        }),

        getJournalVersion: builder.query<
            JournalVersion,
            { dealId: string; versionId: string }
        >({
            query: ({ dealId, versionId }) =>
                `/deals/${dealId}/finance/journal/versions/${versionId}`,
        }),

        saveJournalVersion: builder.mutation<
            { version: JournalVersion; created: boolean },
            { dealId: string }
        >({
            query: ({ dealId }) => ({
                url: `/deals/${dealId}/finance/journal/versions`,
                method: 'POST',
                body: {},
            }),
            invalidatesTags: ['Deal'],
        }),
    }),
})

export const {
    useGetJournalVersionsQuery,
    useGetJournalVersionQuery,
    useSaveJournalVersionMutation,
} = financeJournalApi