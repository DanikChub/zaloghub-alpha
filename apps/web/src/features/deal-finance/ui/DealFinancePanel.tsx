import { useState } from 'react'
import { Alert, Button, Card, Tabs } from 'antd'
import type { Deal } from '../../../entities/deal/model/types'
import { FinanceTermsEditor } from './FinanceTermsEditor'
import { CreditManagement } from './CreditManagement'
import { SettlementPanel } from './SettlementPanel'
import { AccrualJournal } from './AccrualJournal'

export function DealFinancePanel({ deal, ready }: { deal: Deal; ready: boolean }) {
  const [active, setActive] = useState('terms')
  const unavailable = (
    <Alert
      type="info"
      title="Сначала настройте финансовые условия и дождитесь успешного расчёта сделки."
      action={<Button onClick={() => setActive('terms')}>К условиям</Button>}
    />
  )
  return (
    <Card className="deal-section" title="Управление займом">
      <Tabs
        activeKey={active}
        onChange={setActive}
        items={[
          { key: 'terms', label: 'Условия договора', children: <FinanceTermsEditor deal={deal} /> },
            {
                key: 'journal',
                label: 'Журнал начислений',
                children: (
                    <AccrualJournal
                        key={deal.id}
                        dealId={deal.id}
                        ready={ready}
                    />
                ),
            },
          {
            key: 'credits',
            label: 'Переплата и возвраты',
            children: ready ? <CreditManagement deal={deal} /> : unavailable,
          },
          {
            key: 'settlement',
            label: 'Закрытие займа',
            children: ready ? <SettlementPanel deal={deal} /> : unavailable,
          },
        ]}
      />
    </Card>
  )
}
