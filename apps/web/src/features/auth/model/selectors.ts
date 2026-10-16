
import type { RootState } from '../../../app/store/store'

export const selectAccessToken = (state: RootState) =>
    state.auth.accessToken

export const selectAuthChallenge = (state: RootState) =>
    state.auth.challenge

export const selectIsAuthenticated = (state: RootState) =>
    Boolean(state.auth.accessToken)
