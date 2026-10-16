import { useState, type ReactNode } from 'react'
import { Avatar, Button, Dropdown, Layout, Menu, Typography, Grid } from 'antd'
import {
  AppstoreOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAppDispatch } from '../../../app/store/hooks'
import { useGetMeQuery } from '../../../features/auth/api/authApi'
import { logout } from '../../../features/auth/model/authSlice'
import { routePaths } from '../../../shared/config/routes'
import './app-shell.css'

const navigation = [
  { key: routePaths.dashboard, icon: <AppstoreOutlined />, label: <Link to={routePaths.dashboard}>Главная</Link> },
  { key: routePaths.deals, icon: <FileTextOutlined />, label: <Link to={routePaths.deals}>Сделки</Link> },
]

interface AppShellProps {
  children: ReactNode
  title: string
  description: string
}

export function AppShell({ children, title, description }: AppShellProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [collapsed, setCollapsed] = useState(false)
  const { data: user } = useGetMeQuery()

  const handleLogout = () => {
    dispatch(logout())
    navigate(routePaths.login, { replace: true })
  }

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Профиль'
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'П'

  return (
    <Layout className="app-shell">
      <Layout.Sider
        className="app-sidebar"
        width={248}
        collapsedWidth={isMobile ? 0 : 76}
        collapsed={isMobile || collapsed}
        trigger={null}
        theme="light"
      >
        <Link className="app-brand" to={routePaths.dashboard}>
          <span className="app-brand-mark">З</span>
          {(!collapsed && !isMobile) && <span>ЗАЛОГ<span className="app-brand-highlight">ХАБ</span></span>}
        </Link>
        <div className="app-nav-caption">{!collapsed && !isMobile ? 'РАБОЧЕЕ ПРОСТРАНСТВО' : ''}</div>
        <Menu
          mode="inline"
          inlineCollapsed={collapsed || isMobile}
          selectedKeys={[location.pathname]}
          items={navigation}
          className="app-navigation"
        />
        <div className="app-sidebar-bottom">{!collapsed && !isMobile ? 'Управление залоговыми сделками' : ''}</div>
      </Layout.Sider>
      <Layout className="app-main">
        <Layout.Header className="app-topbar">
          <div className="app-topbar-left">
            {!isMobile && (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
              />
            )}
            {isMobile && <Link className="app-mobile-brand" to={routePaths.dashboard}>ЗАЛОГХАБ</Link>}
          </div>
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: 'Мой профиль', onClick: () => navigate(routePaths.profile) },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Выйти', danger: true, onClick: handleLogout },
              ],
            }}
          >
            <Button type="text" className="app-profile-trigger">
              <Avatar size={34} icon={initials === 'П' ? <UserOutlined /> : undefined} className="app-user-avatar">{initials === 'П' ? null : initials}</Avatar>
              <span className="app-profile-name">{displayName}</span>
            </Button>
          </Dropdown>
        </Layout.Header>
        {isMobile && <div className="app-mobile-nav"><Menu mode="horizontal" selectedKeys={[location.pathname]} items={navigation} /></div>}
        <Layout.Content className="app-content">
          <div className="app-page-heading">
            <Typography.Title level={2}>{title}</Typography.Title>
            <Typography.Text type="secondary">{description}</Typography.Text>
          </div>
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
