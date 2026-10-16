import { Button, Card, Flex, Result, Skeleton, Typography } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { useAppDispatch } from '../../../app/store/hooks'
import { useGetMeQuery } from '../../../features/auth/api/authApi'
import { logout } from '../../../features/auth/model/authSlice'
import { routePaths } from '../../../shared/config/routes'
import { getApiErrorMessage } from '../../../shared/lib/api-error'

export function DashboardPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { data: user, isLoading, error, refetch } = useGetMeQuery()

  const handleLogout = () => {
    dispatch(logout())
    navigate(routePaths.login, { replace: true })
  }

  return (
    <div className="dashboard-page">
      <Flex justify="space-between" align="center" wrap="wrap" gap={16} className="dashboard-header">
        <Typography.Text className="dashboard-brand">ЗАЛОГ<span>ХАБ</span></Typography.Text>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>Выйти</Button>
      </Flex>
      <Card className="dashboard-card">
        {isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : error ? (
          <Result status="error" title="Не удалось загрузить профиль" subTitle={getApiErrorMessage(error, 'Проверьте подключение к серверу')} extra={<Button onClick={() => refetch()}>Повторить</Button>} />
        ) : (
          <>
            <Typography.Text type="secondary">Личный кабинет</Typography.Text>
            <Typography.Title level={2} style={{ marginTop: 10 }}>Здравствуйте{user?.firstName ? `, ${user.firstName}` : ''}!</Typography.Title>
            <Typography.Paragraph type="secondary">Вы вошли как {user?.email}. Авторизация успешно работает.</Typography.Paragraph>
            <Typography.Paragraph>Здесь появится рабочее пространство ЗалогХаб.</Typography.Paragraph>
          </>
        )}
      </Card>
    </div>
  )
}
