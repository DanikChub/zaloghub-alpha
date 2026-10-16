import type { ReactNode } from 'react'
import { Card, Typography } from 'antd'
import { SafetyCertificateOutlined, FileProtectOutlined, LineChartOutlined } from '@ant-design/icons'
import './auth-layout.css'

interface AuthLayoutProps {
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
}

export function AuthLayout({ eyebrow, title, description, children }: AuthLayoutProps) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-logo"><span className="auth-logo-mark">З</span><span>ЗАЛОГ<span className="auth-logo-accent">ХАБ</span></span></div>
        <div className="auth-story-content">
          <div className="auth-story-tag"><span className="auth-story-dot" /> ПЛАТФОРМА ДЛЯ ИНВЕСТОРОВ</div>
          <h1>Все сделки.<br />Под вашим <em>контролем.</em></h1>
          <p>Управляйте залоговыми займами, документами и платежами в едином рабочем пространстве.</p>
          <div className="auth-benefits">
            <div><FileProtectOutlined /><span>Порядок в документах и сделках</span></div>
            <div><LineChartOutlined /><span>Прозрачность на каждом этапе</span></div>
            <div><SafetyCertificateOutlined /><span>Ваши данные под контролем</span></div>
          </div>
        </div>
        <div className="auth-story-footer">ЗАЛОГХАБ <span>© {new Date().getFullYear()}</span></div>
      </section>
      <section className="auth-content">
        <div className="auth-mobile-logo"><span className="auth-logo-mark">З</span> ЗАЛОГХАБ</div>
        <Card className="auth-card" variant="borderless">
          <div className="auth-card-heading">
            {eyebrow && <div className="auth-eyebrow">{eyebrow}</div>}
            <Typography.Title level={2}>{title}</Typography.Title>
            {description && <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>}
          </div>
          {children}
        </Card>
        <div className="auth-content-footer">Безопасный доступ к вашему рабочему пространству</div>
      </section>
    </main>
  )
}
