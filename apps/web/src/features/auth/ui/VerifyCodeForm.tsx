import { Alert, Button, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import { routePaths } from '../../../shared/config/routes'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useVerifyCodeMutation } from '../api/authApi'
import { clearChallenge, selectAuthChallenge, setAccessToken } from '../model/authSlice'

interface VerifyValues {
  code: string
}

export function VerifyCodeForm() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const challenge = useAppSelector(selectAuthChallenge)
  const [verifyCode, { isLoading }] = useVerifyCodeMutation()
  const [error, setError] = useState<string | null>(null)

  if (!challenge) return <Navigate to={routePaths.login} replace />

  const handleSubmit = async ({ code }: VerifyValues) => {
    setError(null)
    try {
      const tokens = await verifyCode({ challengeId: challenge.challengeId, code }).unwrap()
      dispatch(setAccessToken(tokens.accessToken))
      navigate(routePaths.dashboard, { replace: true })
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Неверный или просроченный код. Попробуйте войти заново.'))
    }
  }

  return (
    <Form<VerifyValues> layout="vertical" size="large" onFinish={handleSubmit} requiredMark={false}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 24 }} />}
      <Form.Item name="code" label="Код подтверждения" rules={[{ required: true, message: 'Введите код из письма' }, { pattern: /^\d{6}$/, message: 'Код должен состоять из 6 цифр' }]}>
        <Input.OTP length={6} size="large" autoFocus />
      </Form.Item>
      <Typography.Paragraph type="secondary" className="auth-hint">
        Код действует 10 минут. Если письмо не пришло, проверьте папку «Спам».
      </Typography.Paragraph>
      <Button type="primary" block htmlType="submit" loading={isLoading} className="auth-submit">Подтвердить и войти</Button>
      <Typography.Paragraph className="auth-switch">
        <Link to={routePaths.login} onClick={() => dispatch(clearChallenge())}>Вернуться ко входу</Link>
      </Typography.Paragraph>
    </Form>
  )
}
