import { Card, Descriptions, Skeleton, Alert } from 'antd'
import { AppShell } from '../../../widgets/app-shell/ui/AppShell'
import { useGetMeQuery } from '../../../features/auth/api/authApi'
import { getApiErrorMessage } from '../../../shared/lib/api-error'

export function ProfilePage() {
  const { data: user, isLoading, error } = useGetMeQuery()

  return (
    <AppShell title="Мой профиль" description="Информация о вашей учётной записи">
      <Card style={{ borderRadius: 14 }}>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : error ? (
          <Alert type="error" showIcon message={getApiErrorMessage(error, 'Не удалось загрузить профиль')} />
        ) : (
          <Descriptions column={{ xs: 1, sm: 2 }} title="Личные данные">
            <Descriptions.Item label="Имя">{user?.firstName || 'Не указано'}</Descriptions.Item>
            <Descriptions.Item label="Фамилия">{user?.lastName || 'Не указана'}</Descriptions.Item>
            <Descriptions.Item label="Email">{user?.email || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </AppShell>
  )
}
