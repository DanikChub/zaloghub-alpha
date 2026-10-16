import { LoginForm } from '../../../features/auth/ui/LoginForm'
import { AuthLayout } from '../../../widgets/auth-layout/ui/AuthLayout'

export function LoginPage() {
    return (
        <AuthLayout
            title="Вход в ЗалогХаб"
            description="Введите данные для входа в аккаунт"
        >
            <LoginForm />
        </AuthLayout>
    )
}