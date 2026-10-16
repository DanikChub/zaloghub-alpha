import { Navigate, Route, Routes } from 'react-router'
import { routePaths } from '../../shared/config/routes'
import { RoutePlaceholder } from '../../shared/ui/route-placeholder/RoutePlaceholder'
import { LoginPage } from '../../pages/login/ui/LoginPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={routePaths.dashboard} replace />} />
        <Route path={routePaths.login} element={<LoginPage />} />
      <Route path={routePaths.register} element={<RoutePlaceholder title="Регистрация" />} />
      <Route path={routePaths.verify} element={<RoutePlaceholder title="Подтверждение входа" />} />
      <Route path={routePaths.dashboard} element={<RoutePlaceholder title="Обзор" />} />
      <Route path={routePaths.deals} element={<RoutePlaceholder title="Сделки" />} />
      <Route path={routePaths.payments} element={<RoutePlaceholder title="Платежи" />} />
      <Route path={routePaths.settings} element={<RoutePlaceholder title="Настройки" />} />
      <Route path="*" element={<RoutePlaceholder title="Страница не найдена" />} />
    </Routes>
  )
}
