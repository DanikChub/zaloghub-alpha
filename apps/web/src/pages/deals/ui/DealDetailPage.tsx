import { useState } from 'react'
import { Alert, Button, Card, Descriptions, Empty, Popconfirm, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router'
import { AppShell } from '../../../widgets/app-shell/ui/AppShell'
import { useDeleteDisbursementMutation, useDeletePaymentMutation, useGetDealQuery } from '../../../entities/deal/api/dealsApi'
import { borrowerName, date, dealStatuses, issuedTotal, money, paymentTypes, principalReturned } from '../../../entities/deal/lib/format'
import type { Disbursement, Payment } from '../../../entities/deal/model/types'
import { DealForm } from '../../../features/deal-form/ui/DealForm'
import { OperationModal } from '../../../features/deal-operation/ui/OperationModal'
import { routePaths } from '../../../shared/config/routes'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import './deals.css'

export function DealDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: deal, isLoading, error } = useGetDealQuery(id, { skip: !id })
  const [editOpen, setEditOpen] = useState(false)
  const [operation, setOperation] = useState<'payment' | 'disbursement' | null>(null)
  const [deletePayment] = useDeletePaymentMutation()
  const [deleteDisbursement] = useDeleteDisbursementMutation()
  const [notify, holder] = message.useMessage()

  const remove = async (kind: 'payment' | 'disbursement', operationId: string) => {
    try {
      if (kind === 'payment') await deletePayment({ dealId: id, id: operationId }).unwrap()
      else await deleteDisbursement({ dealId: id, id: operationId }).unwrap()
      notify.success('Операция удалена')
    } catch (e) { notify.error(getApiErrorMessage(e)) }
  }

  return <AppShell title={deal ? `Сделка № ${deal.contractNumber || 'без номера'}` : 'Карточка сделки'} description="Условия договора и движение средств">
    {holder}
    <div className="deal-actions">
      <Link to={routePaths.deals}><Button icon={<ArrowLeftOutlined />}>К реестру</Button></Link>
      {deal && <Space><Tag color={deal.status === 'ACTIVE' ? 'green' : deal.status === 'CLOSED' ? 'default' : 'gold'}>{dealStatuses[deal.status]}</Tag><Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>Редактировать</Button></Space>}
    </div>
    {isLoading && <Spin />}
    {error && <Alert type="error" message="Сделка не найдена или недоступна" />}
    {deal && <>
      <div className="deal-detail-grid">
        <Card><Statistic title="Сумма договора" value={Number(deal.principalAmount)} formatter={(value) => money(String(value))} /></Card>
        <Card><Statistic title="Фактически выдано" value={issuedTotal(deal)} formatter={(value) => money(String(value))} /></Card>
        <Card><Statistic title="Возвращено тела" value={principalReturned(deal)} formatter={(value) => money(String(value))} /></Card>
        <Card><Statistic title="Капитал в займе" value={issuedTotal(deal) - principalReturned(deal)} formatter={(value) => money(String(value))} /></Card>
      </div>
      <Card className="deal-section" title="Участники и обеспечение">
        <Descriptions size="small" column={{ xs: 1, md: 2 }} items={[
          { key: 'borrower', label: 'Заёмщик', children: borrowerName(deal) },
          { key: 'collateral', label: 'Объект залога', children: deal.collateral?.address || 'Не выбран' },
          { key: 'cadastre', label: 'Кадастровый номер', children: deal.collateral?.cadastralNumber || '—' },
          { key: 'value', label: 'Оценка залога', children: deal.collateral?.estimatedValue ? money(deal.collateral.estimatedValue) : '—' },
        ]} />
      </Card>
      <Card className="deal-section" title="Условия займа">
        <Descriptions size="small" column={{ xs: 1, md: 3 }} items={[
          { key: 'date', label: 'Дата договора', children: date(deal.signedAt) },
          { key: 'city', label: 'Город', children: deal.contractCity || '—' },
          { key: 'term', label: 'Срок займа', children: `${deal.termMonths} мес.` },
          { key: 'moratorium', label: 'Мораторий', children: `${deal.moratoriumMonths} мес.` },
          { key: 'paymentDay', label: 'День платежа', children: deal.paymentDay },
          { key: 'preferential', label: 'Льготная ставка', children: `${deal.preferentialRate}%/мес.` },
          { key: 'standard', label: 'Основная ставка', children: `${deal.standardRate}%/мес.` },
          { key: 'penalty', label: 'Неустойка', children: `${deal.penaltyRate}%/день` },
          { key: 'increased', label: 'Повышенная неустойка', children: `${deal.increasedPenaltyRate}%/день` },
        ]} />
      </Card>
      <Card className="deal-section" title="Выдачи" extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setOperation('disbursement')}>Добавить выдачу</Button>}>
        <Table size="small" rowKey="id" pagination={false} dataSource={deal.disbursements} locale={{ emptyText: <Empty description="Выдач пока нет" /> }} columns={[
          { title: 'Дата', dataIndex: 'issuedAt', render: (value: string) => date(value) },
          { title: 'Сумма', dataIndex: 'amount', render: (value: string) => money(value) },
          { title: 'Примечание', dataIndex: 'comment', render: (value: string | null) => value || '—' },
          { title: '', key: 'actions', render: (_, row: Disbursement) => <Popconfirm title="Удалить выдачу?" onConfirm={() => remove('disbursement', row.id)}><Button type="link" danger size="small">Удалить</Button></Popconfirm> },
        ]} />
      </Card>
      <Card className="deal-section" title="Поступления" extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setOperation('payment')}>Добавить платёж</Button>}>
        <Table size="small" rowKey="id" pagination={false} dataSource={deal.payments} locale={{ emptyText: <Empty description="Поступлений пока нет" /> }} columns={[
          { title: 'Дата', dataIndex: 'paidAt', render: (value: string) => date(value) },
          { title: 'Тип', dataIndex: 'type', render: (value: Payment['type']) => paymentTypes[value] },
          { title: 'Сумма', dataIndex: 'amount', render: (value: string) => money(value) },
          { title: 'Примечание', dataIndex: 'comment', render: (value: string | null) => value || '—' },
          { title: '', key: 'actions', render: (_, row: Payment) => <Popconfirm title="Удалить платёж?" onConfirm={() => remove('payment', row.id)}><Button type="link" danger size="small">Удалить</Button></Popconfirm> },
        ]} />
      </Card>
      <Typography.Text type="secondary">Показаны только фактические операции. Автоматические начисления и просрочки пока не рассчитываются.</Typography.Text>
      <DealForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => setEditOpen(false)} deal={deal} />
      {operation && <OperationModal dealId={id} kind={operation} open onClose={() => setOperation(null)} />}
    </>}
  </AppShell>
}
