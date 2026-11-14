import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Typography,
} from 'antd'
import {
  ArrowRightOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router'
import { AppShell } from '../../widgets/app-shell/ui/AppShell'
import { useGetBorrowersQuery } from '../../entities/deal/api/dealsApi'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { routePaths } from '../../shared/config/routes'
import { useCreateVerificationMutation, useGetVerificationsQuery } from './api'
import { decisionLabels, formatTime, riskLabels, statusLabels } from './display'
import { RiskTag, StatusTag } from './status-components'
import type { VerificationSummary } from './types'
import './verifications.css'

function CreateVerification({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [form] = Form.useForm()
  const [create, { isLoading }] = useCreateVerificationMutation()
  const { data: borrowers = [], error: borrowersError } = useGetBorrowersQuery(
    undefined,
    { skip: !open || mode !== 'existing' },
  )
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title="Новая проверка заёмщика"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Создать проверку"
      cancelText="Отмена"
      confirmLoading={isLoading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        onFinish={async (values: {
          displayName?: string
          borrowerId?: string
        }) => {
          setError(null)
          try {
            const result = await create(
              mode === 'new'
                ? { displayName: values.displayName?.trim() }
                : { borrowerId: values.borrowerId },
            ).unwrap()
            onClose()
            navigate(routePaths.borrowerVerification(result.id))
          } catch (cause) {
            setError(getApiErrorMessage(cause, 'Не удалось создать проверку'))
          }
        }}
      >
        <Typography.Paragraph type="secondary">
          Проверку можно начать до создания сделки. Паспорт и остальные
          документы добавляются в карточке.
        </Typography.Paragraph>
        <Segmented
          block
          value={mode}
          onChange={(value) => {
            setMode(value === 'existing' ? 'existing' : 'new')
            setError(null)
          }}
          options={[
            { label: 'Новый заёмщик', value: 'new' },
            { label: 'Из реестра заёмщиков', value: 'existing' },
          ]}
          style={{ marginBottom: 24 }}
        />
        {mode === 'new' ? (
          <Form.Item
            name="displayName"
            label="Имя или название проверки"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Укажите имя заёмщика',
              },
            ]}
          >
            <Input
              autoFocus
              placeholder="Например, Иванов Иван Иванович"
              maxLength={300}
            />
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="borrowerId"
              label="Заёмщик"
              rules={[{ required: true, message: 'Выберите заёмщика' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Выберите из списка"
                options={borrowers.map((b) => ({
                  value: b.id,
                  label: [b.lastName, b.firstName, b.middleName]
                    .filter(Boolean)
                    .join(' '),
                }))}
              />
            </Form.Item>
            {borrowersError && (
              <Alert
                type="error"
                showIcon
                title="Не удалось загрузить заёмщиков"
              />
            )}
          </>
        )}
        {error && <Alert type="error" showIcon title={error} />}
      </Form>
    </Modal>
  )
}
export function BorrowerVerificationsPage() {
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(15)
  const [status, setStatus] = useState<string>(),
    [risk, setRisk] = useState<string>(),
    [period, setPeriod] = useState<{ from?: string; to?: string }>({})
  const [createOpen, setCreateOpen] = useState(false)
  const { data, isLoading, isFetching, error, refetch } =
    useGetVerificationsQuery(
      {
        page,
        limit: pageSize,
        ...(status ? { status } : {}),
        ...(risk ? { risk } : {}),
        ...period,
      },
      { refetchOnMountOrArgChange: true },
    )
  const navigate = useNavigate()
  return (
    <AppShell
      title="Проверка заёмщика"
      description="История проверок, результаты и решения по заёмщикам"
    >
      <div className="bv-intro">
        <div className="bv-intro-copy">
          <div className="bv-eyebrow">
            <SafetyCertificateOutlined /> ПРОВЕРКА ПЕРЕД СДЕЛКОЙ
          </div>
          <Typography.Title level={3}>
            Все проверки в одном месте
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            Паспортные данные, документы и результаты каждого этапа — с
            сохранением истории.
          </Typography.Paragraph>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          Новая проверка
        </Button>
      </div>
      <Card
        className="bv-registry"
        title={
          <Space>
            История проверок{' '}
            <Typography.Text type="secondary">
              {data?.total ?? '—'}
            </Typography.Text>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => void refetch()}
            aria-label="Обновить список"
          />
        }
      >
        <div className="bv-filters">
          <Select
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            allowClear
            placeholder="Все статусы"
            aria-label="Статус проверки"
            options={[
              'DRAFT',
              'IN_PROGRESS',
              'AWAITING_DOCUMENTS',
              'READY_FOR_REVIEW',
              'COMPLETED',
              'CANCELLED',
            ].map((value) => ({ value, label: statusLabels[value] }))}
          />
          <Select
            value={risk}
            onChange={(v) => {
              setRisk(v)
              setPage(1)
            }}
            allowClear
            placeholder="Все оценки риска"
            aria-label="Оценка риска"
            options={Object.entries(riskLabels).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <DatePicker.RangePicker
            format="DD.MM.YYYY"
            placeholder={['Создана с', 'Создана по']}
            onChange={(values) => {
              setPage(1)
              setPeriod(
                values?.[0] && values?.[1]
                  ? {
                      from: values[0].startOf('day').toISOString(),
                      to: values[1].endOf('day').toISOString(),
                    }
                  : {},
              )
            }}
          />
        </div>
        {error ? (
          <Alert
            type="error"
            showIcon
            title={getApiErrorMessage(error, 'Не удалось загрузить проверки')}
            action={<Button onClick={() => void refetch()}>Повторить</Button>}
          />
        ) : (
          <Table<VerificationSummary>
            rowKey="id"
            loading={isLoading || isFetching}
            dataSource={data?.items ?? []}
            scroll={{ x: 850 }}
            pagination={{
              current: page,
              pageSize,
              total: data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: [15, 30, 50],
              onChange: (p, size) => {
                setPage(p)
                setPageSize(size)
              },
              showTotal: (total) => `Всего: ${total}`,
            }}
            locale={{
              emptyText: (
                <Empty description="Проверок пока нет">
                  <Button type="primary" onClick={() => setCreateOpen(true)}>
                    Начать первую проверку
                  </Button>
                </Empty>
              ),
            }}
            columns={[
              {
                title: 'Заёмщик',
                key: 'borrower',
                render: (_, row) => (
                  <div>
                    <Link
                      className="bv-person-link"
                      to={routePaths.borrowerVerification(row.id)}
                    >
                      {row.party.displayName}
                    </Link>
                    <div className="bv-muted">
                      {row.party.taxId
                        ? `ИНН ${row.party.taxId}`
                        : 'ИНН не указан'}
                    </div>
                  </div>
                ),
              },
              { title: 'Создана', dataIndex: 'createdAt', render: formatTime },
              {
                title: 'Статус',
                dataIndex: 'status',
                render: (value) => <StatusTag value={value} />,
              },
              {
                title: 'Риск',
                dataIndex: 'overallRisk',
                render: (value) => <RiskTag value={value} />,
              },
              {
                title: 'Решение',
                dataIndex: 'decision',
                render: (value) => decisionLabels[value] ?? value,
              },
              {
                title: '',
                key: 'open',
                width: 50,
                render: (_, row) => (
                  <Button
                    type="text"
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigateTo(row.id)}
                    aria-label={`Открыть проверку ${row.party.displayName}`}
                  />
                ),
              },
            ]}
          />
        )}
      </Card>
      <CreateVerification
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </AppShell>
  )
  function navigateTo(id: string) {
    navigate(routePaths.borrowerVerification(id))
  }
}
