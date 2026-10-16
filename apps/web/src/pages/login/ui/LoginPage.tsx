import { LoginForm } from '../../../features/auth/ui/LoginForm'
import { AuthLayout } from '../../../widgets/auth-layout/ui/AuthLayout'

export function LoginPage() {
  return (
    <AuthLayout eyebrow="С ВОЗВРАЩЕНИЕМ" title="Вход в аккаунт" description="Введите почту и пароль, чтобы продолжить работу.">
      <LoginForm />
    </AuthLayout>
  )
}
