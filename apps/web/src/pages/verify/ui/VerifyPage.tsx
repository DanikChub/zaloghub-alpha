import { VerifyCodeForm } from '../../../features/auth/ui/VerifyCodeForm'
import { AuthLayout } from '../../../widgets/auth-layout/ui/AuthLayout'

export function VerifyPage() {
  return (
    <AuthLayout eyebrow="БЕЗОПАСНОСТЬ" title="Подтвердите вход" description="Мы отправили шестизначный код на вашу электронную почту.">
      <VerifyCodeForm />
    </AuthLayout>
  )
}
