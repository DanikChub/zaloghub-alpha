import { RegisterForm } from '../../../features/auth/ui/RegisterForm'
import { AuthLayout } from '../../../widgets/auth-layout/ui/AuthLayout'

export function RegisterPage() {
  return (
    <AuthLayout eyebrow="НОВЫЙ АККАУНТ" title="Создайте аккаунт" description="Начните управлять сделками и документами в одном месте.">
      <RegisterForm />
    </AuthLayout>
  )
}
