import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import {
  useGetVerificationRisksQuery,
  useVerificationActionMutation,
} from './api'
import type { CheckItem, CheckRun, Risk, Verification } from './types'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { formatDate } from './display'
const severityLabels: Record<string, string> = {
  LOW: 'Низкая',
  MEDIUM: 'Средняя',
  HIGH: 'Высокая',
  CRITICAL: 'Критическая',
}
const riskStatus: Record<string, string> = {
  OPEN: 'Открыт',
  IN_PROGRESS: 'Устраняется',
  RESOLVED: 'Устранён',
  DISMISSED: 'Отклонён',
}
export function ManualRiskModal({
  id,
  item,
  run,
  onClose,
}: {
  id: string
  item: CheckItem
  run: CheckRun
  onClose: () => void
}) {
  const [form] = Form.useForm(),
    [action, { isLoading }] = useVerificationActionMutation()
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      open
      title="Добавить риск"
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Сохранить риск"
      cancelText="Отмена"
      confirmLoading={isLoading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ severity: 'MEDIUM', remediability: 'UNKNOWN' }}
        onFinish={async (values: Record<string, unknown>) => {
          const body = Object.fromEntries(
            Object.entries(values).filter(
              ([, value]) => value !== '' && value !== undefined,
            ),
          )
          try {
            await action({
              id,
              path: 'risks',
              body: {
                ...body,
                itemId: item.id,
                runId: run.id,
                riskCode: crypto.randomUUID(),
              },
            }).unwrap()
            onClose()
          } catch (cause) {
            setError(getApiErrorMessage(cause, 'Не удалось добавить риск'))
          }
        }}
      >
        <Typography.Paragraph type="secondary">
          {item.title} · запуск № {run.attemptNo}
        </Typography.Paragraph>
        <Form.Item
          name="title"
          label="Название"
          rules={[{ required: true, whitespace: true }]}
        >
          <Input maxLength={500} />
        </Form.Item>
        <Form.Item
          name="description"
          label="Обоснование"
          rules={[{ required: true, whitespace: true }]}
        >
          <Input.TextArea rows={3} maxLength={4000} />
        </Form.Item>
        <Form.Item name="severity" label="Критичность">
          <Select
            options={Object.entries(severityLabels).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Form.Item>
        <Form.Item name="remediability" label="Возможность устранения">
          <Select
            options={[
              { value: 'UNKNOWN', label: 'Требует оценки' },
              { value: 'REMEDIABLE', label: 'Устраним' },
              { value: 'NON_REMEDIABLE', label: 'Неустраним' },
            ]}
          />
        </Form.Item>
        <Form.Item name="requiredAction" label="Что необходимо сделать">
          <Input.TextArea rows={2} maxLength={4000} />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} />}
      </Form>
    </Modal>
  )
}
export function VerificationRisksCard({
  verification,
}: {
  verification: Verification
}) {
  const {
    data: risks = [],
    error,
    isLoading,
  } = useGetVerificationRisksQuery(verification.id, {
    pollingInterval: verification.allowedActions.edit ? 5000 : 0,
    skipPollingIfUnfocused: true,
  })
  const [scope, setScope] = useState('current')
  const [editing, setEditing] = useState<{
    risk: Risk
    action: 'resolve' | 'dismiss' | 'update'
  } | null>(null)
  const [form] = Form.useForm(),
    [action, { isLoading: saving }] = useVerificationActionMutation()
  const [notify, holder] = message.useMessage(),
    [saveError, setSaveError] = useState<string | null>(null)
  const currentIds = new Set(
    verification.items
      .filter((i) => i.status !== 'STALE')
      .map((i) => i.runs?.[0]?.id ?? i.acceptedRunId)
      .filter(Boolean),
  )
  const current = risks.filter((r) => currentIds.has(r.runId))
  const shown = scope === 'current' ? current : risks
  const sources = verification.evidence.filter(
    (e) => !e.runId && e.authenticityStatus === 'CONFIRMED',
  )
  return (
    <Card
      className="bv-section"
      loading={isLoading}
      title={
        <Space>
          <WarningOutlined /> Риски и условия{' '}
          <Tag
            color={
              current.some((r) => ['OPEN', 'IN_PROGRESS'].includes(r.status))
                ? 'orange'
                : 'default'
            }
          >
            {
              current.filter((r) => ['OPEN', 'IN_PROGRESS'].includes(r.status))
                .length
            }{' '}
            открыто
          </Tag>
        </Space>
      }
      extra={
        <Segmented
          size="small"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'current', label: 'Текущие' },
            { value: 'all', label: 'История' },
          ]}
        />
      }
    >
      {holder}
      {error && (
        <Alert
          type="error"
          showIcon
          title={getApiErrorMessage(error, 'Не удалось загрузить риски')}
        />
      )}
      {!error && shown.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Риски не зафиксированы. Это не означает, что все проверки выполнены."
        />
      )}
      <div className="bv-risk-list">
        {shown.map((r) => (
          <div
            className={`bv-risk-card bv-risk-${r.status.toLowerCase()}`}
            key={r.id}
          >
            <div className="bv-between">
              <Space wrap>
                <Typography.Text strong>{r.title}</Typography.Text>
                <Tag
                  color={
                    ['HIGH', 'CRITICAL'].includes(r.severity) ? 'red' : 'orange'
                  }
                >
                  {severityLabels[r.severity]}
                </Tag>
                <Tag>{riskStatus[r.status]}</Tag>
                {!currentIds.has(r.runId) && <Tag>Прошлый запуск</Tag>}
              </Space>
            </div>
            <Typography.Paragraph>{r.description}</Typography.Paragraph>
            {r.requiredAction && (
              <Typography.Paragraph>
                <strong>Условие:</strong> {r.requiredAction}
              </Typography.Paragraph>
            )}
            {r.dueAt && (
              <div className="bv-muted">Срок: {formatDate(r.dueAt)}</div>
            )}
            {r.resolutionComment && (
              <Typography.Paragraph type="secondary">
                {r.resolutionComment}
              </Typography.Paragraph>
            )}
            {verification.allowedActions.edit &&
              ['OPEN', 'IN_PROGRESS'].includes(r.status) && (
                <Space wrap>
                  {r.status === 'OPEN' && (
                    <Button
                      size="small"
                      onClick={async () => {
                        try {
                          await action({
                            id: verification.id,
                            path: `risks/${r.id}/start-remediation`,
                          }).unwrap()
                        } catch (cause) {
                          notify.error(
                            getApiErrorMessage(
                              cause,
                              'Не удалось обновить риск',
                            ),
                          )
                        }
                      }}
                    >
                      Взять в работу
                    </Button>
                  )}
                  <Button size="small" onClick={() => open(r, 'update')}>
                    Условие устранения
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => open(r, 'resolve')}
                  >
                    Подтвердить устранение
                  </Button>
                  <Button
                    size="small"
                    type="text"
                    onClick={() => open(r, 'dismiss')}
                  >
                    Отклонить риск
                  </Button>
                </Space>
              )}
          </div>
        ))}
      </div>
      <Modal
        open={Boolean(editing)}
        title={
          editing?.action === 'resolve'
            ? 'Подтвердить устранение риска'
            : editing?.action === 'dismiss'
              ? 'Отклонить риск'
              : 'Условие устранения'
        }
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form
          form={form}
          preserve={false}
          layout="vertical"
          onFinish={async (values: Record<string, unknown>) => {
            if (!editing) return
            const body =
              editing.action === 'update'
                ? {
                    requiredAction: values.requiredAction,
                    ...(values.dueAt
                      ? {
                          dueAt: new Date(
                            `${values.dueAt}T23:59:59`,
                          ).toISOString(),
                        }
                      : {}),
                  }
                : values
            try {
              await action({
                id: verification.id,
                path: `risks/${editing.risk.id}${editing.action === 'update' ? '' : `/${editing.action}`}`,
                method: editing.action === 'update' ? 'PATCH' : 'POST',
                body,
              }).unwrap()
              setEditing(null)
            } catch (cause) {
              setSaveError(getApiErrorMessage(cause, 'Не удалось сохранить'))
            }
          }}
        >
          <Typography.Paragraph>{editing?.risk.title}</Typography.Paragraph>
          {editing?.action === 'update' ? (
            <>
              <Form.Item
                name="requiredAction"
                label="Что необходимо сделать"
                rules={[{ required: true, whitespace: true }]}
              >
                <Input.TextArea rows={3} maxLength={4000} />
              </Form.Item>
              <Form.Item name="dueAt" label="Срок">
                <Input type="date" />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="comment"
                label="Обоснование"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: 'Добавьте обоснование',
                  },
                ]}
              >
                <Input.TextArea rows={3} maxLength={4000} />
              </Form.Item>
              {editing?.action === 'resolve' && (
                <Form.Item
                  name="evidenceId"
                  label="Подтверждённое доказательство"
                  rules={[
                    {
                      required: true,
                      message: 'Выберите доказательство устранения',
                    },
                  ]}
                >
                  <Select
                    placeholder="Выберите проверенный документ или источник"
                    options={sources.map((e) => ({
                      value: e.id,
                      label: e.title,
                    }))}
                  />
                </Form.Item>
              )}
            </>
          )}
          {saveError && <Alert type="error" showIcon title={saveError} />}
        </Form>
      </Modal>
    </Card>
  )
  function open(risk: Risk, mode: 'resolve' | 'dismiss' | 'update') {
    setEditing({ risk, action: mode })
    setSaveError(null)
    form.resetFields()
    form.setFieldsValue({
      requiredAction: risk.requiredAction ?? '',
      dueAt: risk.dueAt?.slice(0, 10),
    })
  }
}
