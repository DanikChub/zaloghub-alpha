
import {
    createListenerMiddleware,
} from '@reduxjs/toolkit'

import { saveToken } from '../../features/auth/model/sessionStorage'
import { logout, setAccessToken } from '../../features/auth/model/authSlice'
import { baseApi } from '../../shared/api/baseApi'

export const authListener = createListenerMiddleware()

authListener.startListening({
    actionCreator: logout,
    effect: async (_, listenerApi) => {
        saveToken(null)
        listenerApi.dispatch(baseApi.util.resetApiState())
    },
})

authListener.startListening({
    actionCreator: setAccessToken,
    effect: (action) => { saveToken(action.payload) },
})
