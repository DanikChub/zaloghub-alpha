
import { useCallback } from 'react'

import { useAppDispatch } from '../../../app/store/hooks'
import { baseApi } from '../../../shared/api/baseApi'
import { logout } from './authSlice'

export function useLogout() {
    const dispatch = useAppDispatch()

    return useCallback(() => {
        dispatch(logout())
        dispatch(baseApi.util.resetApiState())
    }, [dispatch])
}
