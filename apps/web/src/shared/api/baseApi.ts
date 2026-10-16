import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { apiConfig } from '../config/api'

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: apiConfig.baseUrl,
  }),
  tagTypes: ['User', 'Deal', 'Payment'],
  endpoints: () => ({}),
})
