import { useState } from 'react'
import { Alert, Button, Card, Empty, Input, Popconfirm, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { AppShell } from '../../../widgets/app-shell/ui/AppShell'
import { useDeleteDealMutation, useGetDealsQuery, useGetDealSummaryQuery } from '../../../entities/deal/api/dealsApi'
import type { Deal } from '../../../entities/deal/model/types'
import { borrowerName, dealStatuses, issuedTotal, money, principalReturned } from '../../../entities/deal/lib/format'
import { DealForm } from '../../../features/deal-form/ui/DealForm'
import { routePaths } from '../../../shared/config/routes'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import './deals.css'

export function DealsPage() {
  const navigate = useNavigate()
  const { data: deals = [], isLoading, error } = useGetDealsQuery()
  const { data: summary } = useGetDealSummaryQuery()
  const [deleteDeal] = useDeleteDealMutation()
  const [notify, holder] = message.useMessage()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = deals.filter((deal) => [deal.contractNumber, borrowerName(deal), deal.collateral?.address].join(' ').toLowerCase().includes(search.toLowerCase()))

  return <AppShell title="Сделки" description="Финансовый реестр займов">
    {holder}
    <div className="deals-summary">
      <Card><Statistic title="Всего выдано" value={summary?.issued ?? 0} formatter={(value) => money(String(value))} /></Card>
      <Card><Statistic title="Капитал в займах" value={summary?.outstandingCapital ?? 0} formatter={(value) => money(String(value))} /></Card>
      <Card><Statistic title="Возвращено тела" value={summary?.principalReturned ?? 0} formatter={(value) => money(String(value))} /></Card>
      <Card><Statistic title="Получено процентов" value={summary?.interestReceived ?? 0} formatter={(value) => money(String(value))} /></Card>
    </div>
    <Card className="deals-table-card">
      <div className="deals-toolbar">
        <Space><Typography.Text strong>Реестр сделок</Typography.Text><Tag>{deals.length}</Tag></Space>
        <Space wrap>
          <Input prefix={<SearchOutlined />} placeholder="Поиск по номеру, заёмщику, залогу" value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: 270 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Новая сделка</Button>
        </Space>
      </div>
      {error && <Alert type="error" message="Не удалось загрузить сделки" showIcon />}
      {isLoading ? <div className="deals-loading"><Spin /></div> : <Table rowKey="id" size="small" dataSource={filtered} pagination={{ pageSize: 15 }} locale={{ emptyText: <Empty description="Сделок пока нет. Создайте первую." /> }} onRow={(record) => ({ onClick: () => navigate(routePaths.deal(record.id)), style: { cursor: 'pointer' } })} columns={[
        { title: 'Договор', key: 'number', render: (_, deal: Deal) => <Typography.Text strong>№ {deal.contractNumber || '—'}</Typography.Text> },
        { title: 'Заёмщик', key: 'borrower', render: (_, deal: Deal) => borrowerName(deal) },
        { title: 'Залог', key: 'collateral', ellipsis: true, render: (_, deal: Deal) => deal.collateral?.address ?? 'Не указан' },
        { title: 'Сумма договора', dataIndex: 'principalAmount', render: (value: string) => money(value), align: 'right' as const },
        { title: 'Выдано', key: 'issued', align: 'right' as const, render: (_, deal: Deal) => money(issuedTotal(deal)) },
        { title: 'Остаток капитала', key: 'balance', align: 'right' as const, render: (_, deal: Deal) => money(issuedTotal(deal) - principalReturned(deal)) },
        { title: 'Статус', dataIndex: 'status', render: (value: Deal['status']) => <Tag color={value === 'ACTIVE' ? 'green' : value === 'CLOSED' ? 'default' : 'gold'}>{dealStatuses[value]}</Tag> },
        { title: '', key: 'actions', width: 90, render: (_, deal: Deal) => <span onClick={(event) => event.stopPropagation()}><Popconfirm title="Удалить сделку?" description="Сделка будет скрыта из реестра" onConfirm={async () => { try { await deleteDeal(deal.id).unwrap(); notify.success('Сделка удалена') } catch (error) { notify.error(getApiErrorMessage(error)) } }}><Button size="small" danger type="link">Удалить</Button></Popconfirm></span> },
      ]} />}
    </Card>
    <DealForm open={createOpen} onClose={() => setCreateOpen(false)} onSaved={(id) => { setCreateOpen(false); navigate(routePaths.deal(id)) }} />
  </AppShell>
}
