import type { ReactNode } from 'react'
import { LoginPage } from '../../pages/login/ui/LoginPage'
import { RegisterPage } from '../../pages/register/ui/RegisterPage'
import { VerifyPage } from '../../pages/verify/ui/VerifyPage'
import { DashboardPage } from '../../pages/dashboard/ui/DashboardPage'
import { DealsPage } from '../../pages/deals/ui/DealsPage'
import { DealDetailPage } from '../../pages/deals/ui/DealDetailPage'
import { ProfilePage } from '../../pages/profile/ui/ProfilePage'
import { routePaths } from '../../shared/config/routes'

export type RouteAccess = 'public' | 'challenge' | 'private'

interface AppRoute {
  path: string
  element: ReactNode
  access: RouteAccess
}

export const appRoutes: AppRoute[] = [
  { path: routePaths.login, element: <LoginPage />, access: 'public' },
  { path: routePaths.register, element: <RegisterPage />, access: 'public' },
  { path: routePaths.verify, element: <VerifyPage />, access: 'challenge' },
  { path: routePaths.dashboard, element: <DashboardPage />, access: 'private' },
  { path: routePaths.deals, element: <DealsPage />, access: 'private' },
  { path: routePaths.dealDetail, element: <DealDetailPage />, access: 'private' },
  { path: routePaths.profile, element: <ProfilePage />, access: 'private' },
]
