import { setupListeners } from '@reduxjs/toolkit/query'
import { configureStore } from '@reduxjs/toolkit'
import { authReducer } from '../../features/auth/model/authSlice'
import { themeReducer } from '../../features/theme/model/themeSlice'
import { baseApi } from '../../shared/api/baseApi'
import { authListener } from './authListener'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(authListener.middleware).concat(baseApi.middleware),
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
