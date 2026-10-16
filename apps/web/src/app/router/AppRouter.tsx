import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAppSelector } from '../store/hooks'
import { selectAccessToken, selectAuthChallenge } from '../../features/auth/model/authSlice'
import { routePaths } from '../../shared/config/routes'
import { appRoutes, type RouteAccess } from './routes'

function RouteGate({ access, children }: { access: RouteAccess; children: ReactNode }) {
  const token = useAppSelector(selectAccessToken)
  const challenge = useAppSelector(selectAuthChallenge)

  if (access === 'private' && !token) {
    return <Navigate to={routePaths.login} replace />
  }

  if (access === 'challenge' && !challenge) {
    return <Navigate to={token ? routePaths.dashboard : routePaths.login} replace />
  }

  if (access === 'public' && token) {
    return <Navigate to={routePaths.dashboard} replace />
  }

  return children
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={routePaths.dashboard} replace />} />
      {appRoutes.map(({ path, element, access }) => (
        <Route key={path} path={path} element={<RouteGate access={access}>{element}</RouteGate>} />
      ))}
      <Route path="*" element={<Navigate to={routePaths.dashboard} replace />} />
    </Routes>
  )
}
