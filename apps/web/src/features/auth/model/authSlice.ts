
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthChallenge, AuthState } from './types'

const initialState: AuthState = {
    accessToken: null,
    challenge: null,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setChallenge(
            state,
            action: PayloadAction<AuthChallenge>,
        ) {
            state.challenge = action.payload
        },

        setAccessToken(
            state,
            action: PayloadAction<string>,
        ) {
            state.accessToken = action.payload
            state.challenge = null
        },

        clearChallenge(state) {
            state.challenge = null
        },

        logout(state) {
            state.accessToken = null
            state.challenge = null
        },


    },
    selectors: {
        selectAccessToken: (state) => state.accessToken,
        selectAuthChallenge: (state) => state.challenge,
        selectIsAuthenticated: (state) =>
            Boolean(state.accessToken),
    },
})

export const {
    setChallenge,
    setAccessToken,
    clearChallenge,
    logout,
} = authSlice.actions

export const {
    selectAccessToken,
    selectAuthChallenge,
    selectIsAuthenticated,
} = authSlice.selectors

export const authReducer = authSlice.reducer
