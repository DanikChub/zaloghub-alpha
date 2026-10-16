import { Alert, Button, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { routePaths } from '../../../shared/config/routes'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useRegisterMutation } from '../api/authApi'
import { setChallenge } from '../model/authSlice'
import type { RegisterRequest } from '../model/types'
import { useAppDispatch } from '../../../app/store/hooks'

type RegisterValues = RegisterRequest & { confirmPassword: string }

export function RegisterForm() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [register, { isLoading }] = useRegisterMutation()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async ({ confirmPassword: _confirmPassword, ...values }: RegisterValues) => {
    setError(null)
    try {
      const challenge = await register({
        ...values,
        email: values.email.trim().toLowerCase(),
      }).unwrap()
      dispatch(setChallenge(challenge))
      navigate(routePaths.verify)
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Не удалось создать аккаунт. Попробуйте ещё раз.'))
    }
  }

  return (
    <Form<RegisterValues> layout="vertical" size="large" requiredMark={false} onFinish={handleSubmit}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 20 }} />}
      <div className="auth-form-row">
        <Form.Item name="firstName" label="Имя" rules={[{ max: 100, message: 'Максимум 100 символов' }]}>
          <Input placeholder="Иван" autoComplete="given-name" />
        </Form.Item>
        <Form.Item name="lastName" label="Фамилия" rules={[{ max: 100, message: 'Максимум 100 символов' }]}>
          <Input placeholder="Иванов" autoComplete="family-name" />
        </Form.Item>
      </div>
      <Form.Item name="email" label="Электронная почта" rules={[{ required: true, message: 'Введите email' }, { type: 'email', message: 'Укажите корректный email' }]}>
        <Input placeholder="name@company.ru" autoComplete="email" />
      </Form.Item>
      <Form.Item name="password" label="Пароль" extra="Не менее 12 символов" rules={[{ required: true, message: 'Придумайте пароль' }, { min: 12, message: 'Минимум 12 символов' }, { max: 128, message: 'Максимум 128 символов' }]}>
        <Input.Password placeholder="Придумайте пароль" autoComplete="new-password" />
      </Form.Item>
      <Form.Item name="confirmPassword" label="Повторите пароль" dependencies={['password']} rules={[{ required: true, message: 'Повторите пароль' }, ({ getFieldValue }) => ({ validator(_, value: string) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('Пароли не совпадают')) } })]}>
        <Input.Password placeholder="Повторите пароль" autoComplete="new-password" />
      </Form.Item>
      <Button block type="primary" htmlType="submit" loading={isLoading} className="auth-submit">Создать аккаунт</Button>
      <Typography.Paragraph className="auth-switch">
        Уже есть аккаунт? <Link to={routePaths.login}>Войти</Link>
      </Typography.Paragraph>
    </Form>
  )
}
