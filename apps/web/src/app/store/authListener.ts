
import {
    createListenerMiddleware,
} from '@reduxjs/toolkit'

import { logout } from '../../features/auth/model/authSlice'
import { baseApi } from '../../shared/api/baseApi'

export const authListener = createListenerMiddleware()

authListener.startListening({
    actionCreator: logout,
    effect: async (_, listenerApi) => {
        listenerApi.dispatch(baseApi.util.resetApiState())
    },
})
