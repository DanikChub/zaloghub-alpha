
import {
  createApi,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react'

import { apiConfig } from '../config/api'

interface AuthState {
  accessToken: string | null
}

interface ApiState {
  auth?: AuthState
}

const baseQuery = fetchBaseQuery({
  baseUrl: apiConfig.baseUrl,

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
  baseQuery,
  tagTypes: ['User', 'Deal', 'Payment'],
  endpoints: () => ({}),
})
