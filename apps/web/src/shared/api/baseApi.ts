import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import { apiConfig } from '../config/api'

interface AuthState {
  accessToken: string | null
}

interface ApiState {
  auth?: AuthState
}

const baseQuery = fetchBaseQuery({
  baseUrl: apiConfig.baseUrl,
  timeout: 45000,

  prepareHeaders: (headers, { getState }) => {
    const state = getState() as ApiState
    const token = state.auth?.accessToken

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return headers
  },
})

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: async (args, api, extraOptions) => {
    const result = await baseQuery(args, api, extraOptions)
    const url = typeof args === 'string' ? args : args.url
    if (result.error?.status === 401 && !['/auth/login', '/auth/register', '/auth/verify'].includes(url)) {
      api.dispatch({ type: 'auth/logout' })
    }
    return result
  },
  tagTypes: ['User', 'Deal', 'Payment', 'Calendar', 'Marketplace'],
  endpoints: () => ({}),
})
