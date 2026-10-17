import { Alert, Card, Descriptions, Radio, Skeleton, Typography } from 'antd'
import { AppShell } from '../../../widgets/app-shell/ui/AppShell'
import { useGetMeQuery } from '../../../features/auth/api/authApi'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import { selectTheme, setTheme } from '../../../features/theme/model/themeSlice'
import type { AppThemeName } from '../../../app/styles/theme-presets'
import './profile.css'

const themeOptions = [
  { label: 'Светлая', value: 'light' },
  { label: 'Тёмная', value: 'dark' },
  { label: 'Фирменная', value: 'brand' },
]

export function ProfilePage() {
  const { data: user, isLoading, error } = useGetMeQuery()
  const dispatch = useAppDispatch()
  const currentTheme = useAppSelector(selectTheme)

  return (
    <AppShell title="Мой профиль" description="Учётная запись и параметры интерфейса">
      <div className="profile-sections">
        <Card title="Личные данные" className="profile-section">
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : error ? (
            <Alert type="error" showIcon message={getApiErrorMessage(error, 'Не удалось загрузить профиль')} />
          ) : (
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Имя">{user?.firstName || 'Не указано'}</Descriptions.Item>
              <Descriptions.Item label="Фамилия">{user?.lastName || 'Не указана'}</Descriptions.Item>
              <Descriptions.Item label="Email">{user?.email || '—'}</Descriptions.Item>
            </Descriptions>
          )}
        </Card>
        <Card title="Внешний вид" className="profile-section">
          <div className="profile-setting">
            <div>
              <Typography.Text strong>Тема оформления</Typography.Text>
              <Typography.Paragraph type="secondary">Настройка применяется сразу и сохраняется на этом устройстве.</Typography.Paragraph>
            </div>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={themeOptions}
              value={currentTheme}
              onChange={(event) => dispatch(setTheme(event.target.value as AppThemeName))}
            />
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
