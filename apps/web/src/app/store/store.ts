
import { configureStore } from '@reduxjs/toolkit'

import { authReducer } from '../../features/auth/model/authSlice'
import { baseApi } from '../../shared/api/baseApi'
import { authListener } from './authListener'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },

  middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
          .prepend(authListener.middleware)
          .concat(baseApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
