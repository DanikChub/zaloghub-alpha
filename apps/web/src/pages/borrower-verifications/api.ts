import { baseApi } from '../../shared/api/baseApi'
import { apiConfig } from '../../shared/config/api'
import type {
  CheckRun,
  Evidence,
  Risk,
  Verification,
  VerificationSummary,
} from './types'
const root = '/borrower-verifications'
export const verificationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVerifications: builder.query<
      {
        items: VerificationSummary[]
        total: number
        page: number
        limit: number
      },
      Record<string, string | number>
    >({
      query: (params) => ({ url: root, params }),
      providesTags: [{ type: 'Verification', id: 'LIST' }],
    }),
    getVerification: builder.query<Verification, string>({
      query: (id) => `${root}/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Verification', id }],
    }),
    getVerificationRuns: builder.query<
      CheckRun[],
      { id: string; itemId: string }
    >({
      query: ({ id, itemId }) => `${root}/${id}/items/${itemId}/runs`,
      providesTags: (_r, _e, { id }) => [{ type: 'Verification', id }],
    }),
    getVerificationRun: builder.query<
      CheckRun,
      { id: string; itemId: string; runId: string }
    >({
      query: ({ id, itemId, runId }) =>
        `${root}/${id}/items/${itemId}/runs/${runId}`,
      providesTags: (_r, _e, { id }) => [{ type: 'Verification', id }],
    }),
    getVerificationRisks: builder.query<Risk[], string>({
      query: (id) => `${root}/${id}/risks`,
      providesTags: (_r, _e, id) => [{ type: 'Verification', id }],
    }),
    verificationAction: builder.mutation<
      unknown,
      {
        id: string
        path: string
        method?: 'POST' | 'PUT' | 'PATCH'
        body?: unknown
        idempotencyKey?: string
      }
    >({
      query: ({ id, path, method = 'POST', body, idempotencyKey }) => ({
        url: `${root}/${id}/${path}`,
        method,
        body,
        headers: idempotencyKey
          ? { 'Idempotency-Key': idempotencyKey }
          : undefined,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Verification', id },
        { type: 'Verification', id: 'LIST' },
      ],
    }),
    createVerification: builder.mutation<
      VerificationSummary,
      { displayName?: string; borrowerId?: string }
    >({
      query: (body) => ({ url: root, method: 'POST', body }),
      invalidatesTags: [{ type: 'Verification', id: 'LIST' }],
    }),
    uploadVerificationEvidence: builder.mutation<
      Evidence,
      { id: string; body: FormData }
    >({
      query: ({ id, body }) => ({
        url: `${root}/${id}/evidence`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Verification', id }],
    }),
  }),
})
export const {
  useGetVerificationsQuery,
  useGetVerificationQuery,
  useGetVerificationRunsQuery,
  useGetVerificationRunQuery,
  useGetVerificationRisksQuery,
  useVerificationActionMutation,
  useCreateVerificationMutation,
  useUploadVerificationEvidenceMutation,
} = verificationApi
export async function downloadEvidence(
  id: string,
  evidence: Evidence,
  token: string,
) {
  const response = await fetch(
    `${apiConfig.baseUrl}${root}/${id}/evidence/${evidence.id}/content`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(45000),
    },
  )
  if (!response.ok) {
    throw {
      status: response.status,
      data: await response.json().catch(() => ({})),
    }
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = evidence.document?.originalFilename ?? evidence.title
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
