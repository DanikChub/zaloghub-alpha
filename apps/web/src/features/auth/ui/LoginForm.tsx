import { Alert, Button, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAppDispatch } from '../../../app/store/hooks'
import { routePaths } from '../../../shared/config/routes'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useLoginMutation } from '../api/authApi'
import { setChallenge } from '../model/authSlice'
import type { LoginRequest } from '../model/types'

export function LoginForm() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [login, { isLoading }] = useLoginMutation()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (values: LoginRequest) => {
    setError(null)
    try {
      const challenge = await login({ ...values, email: values.email.trim().toLowerCase() }).unwrap()
      dispatch(setChallenge(challenge))
      navigate(routePaths.verify)
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Не удалось войти. Проверьте email и пароль.'))
    }
  }

  return (
    <Form<LoginRequest> layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large">
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 20 }} />}
      <Form.Item name="email" label="Электронная почта" rules={[{ required: true, message: 'Введите email' }, { type: 'email', message: 'Некорректный email' }]}>
        <Input type="email" placeholder="name@company.ru" autoComplete="email" />
      </Form.Item>
      <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}>
        <Input.Password placeholder="Введите пароль" autoComplete="current-password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={isLoading} block className="auth-submit">Войти в аккаунт</Button>
      <Typography.Paragraph className="auth-switch">
        Нет аккаунта? <Link to={routePaths.register}>Зарегистрироваться</Link>
      </Typography.Paragraph>
    </Form>
  )
}
