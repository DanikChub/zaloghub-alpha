
import { Alert, Button, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router'

import { routePaths } from '../../../shared/config/routes'
import { useLoginMutation } from '../api/authApi'
import { setChallenge } from '../model/authSlice'
import type { LoginRequest } from '../model/types'

const { Link } = Typography

export function LoginForm() {
    const navigate = useNavigate()
    const dispatch = useDispatch()

    const [login, { isLoading }] = useLoginMutation()
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (values: LoginRequest) => {
        setError(null)

        try {
            const challenge = await login(values).unwrap()

            dispatch(setChallenge(challenge))
            navigate(routePaths.verify)
        } catch {
            setError('Не удалось войти. Проверьте email и пароль.')
        }
    }

    return (
        <Form<LoginRequest>
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
            size="large"
        >
            {error && (
                <Form.Item>
                    <Alert type="error" message={error} showIcon />
                </Form.Item>
            )}

            <Form.Item
                name="email"
                label="Электронная почта"
                rules={[
                    { required: true, message: 'Введите email' },
                    { type: 'email', message: 'Некорректный email' },
                ]}
            >
                <Input
                    type="email"
                    placeholder="example@mail.ru"
                    autoComplete="email"
                />
            </Form.Item>

            <Form.Item
                name="password"
                label="Пароль"
                rules={[
                    { required: true, message: 'Введите пароль' },
                ]}
            >
                <Input.Password
                    placeholder="Введите пароль"
                    autoComplete="current-password"
                />
            </Form.Item>

            <Form.Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    loading={isLoading}
                    block
                >
                    Войти
                </Button>
            </Form.Item>

            <Typography.Paragraph style={{ textAlign: 'center' }}>
                Нет аккаунта?{' '}
                <Link onClick={() => navigate(routePaths.register)}>
                    Зарегистрироваться
                </Link>
            </Typography.Paragraph>
        </Form>
    )
}
