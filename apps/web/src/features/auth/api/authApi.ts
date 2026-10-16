
import { baseApi } from '../../../shared/api/baseApi'
import type { User } from '../../../entities/user'

import type {
    AuthChallenge,
    AuthTokens,
    LoginRequest,
    RegisterRequest,
    VerifyCodeRequest,
} from '../model/types'

export const authApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        register: builder.mutation<AuthChallenge, RegisterRequest>({
            query: (body) => ({
                url: '/auth/register',
                method: 'POST',
                body,
            }),
        }),

        login: builder.mutation<AuthChallenge, LoginRequest>({
            query: (body) => ({
                url: '/auth/login',
                method: 'POST',
                body,
            }),
        }),

        verifyCode: builder.mutation<AuthTokens, VerifyCodeRequest>({
            query: (body) => ({
                url: '/auth/verify',
                method: 'POST',
                body,
            }),
        }),

        getMe: builder.query<User, void>({
            query: () => '/auth/me',
            providesTags: ['User'],
        }),
    }),
})

export const {
    useRegisterMutation,
    useLoginMutation,
    useVerifyCodeMutation,
    useGetMeQuery,
} = authApi
