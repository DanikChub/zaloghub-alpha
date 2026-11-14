import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Result,
  Select,
  Skeleton,
  Space,
  Steps,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router'
import { useAppSelector } from '../../app/store/hooks'
import { AppShell } from '../../widgets/app-shell/ui/AppShell'
import { routePaths } from '../../shared/config/routes'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import {
  useGetVerificationQuery,
  useVerificationActionMutation,
  verificationApi,
} from './api'
import type { Verification } from './types'
import { decisionLabels, formatTime } from './display'
import { RiskTag, StatusTag } from './status-components'
import { VerificationIdentityCard } from './VerificationIdentityCard'
import { VerificationDocumentsCard } from './VerificationDocumentsCard'
import { VerificationChecklist } from './VerificationChecklist'
import { VerificationRisksCard } from './VerificationRisksCard'
import './verifications.css'
function FinalDecision({
  verification,
  revision,
  onClose,
}: {
  verification: Verification
  revision: string
  onClose: () => void
}) {
  const [form] = Form.useForm(),
    [action, { isLoading }] = useVerificationActionMutation()
  const decision = Form.useWatch('decision', form)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      open
      title="Итоговое решение"
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Зафиксировать решение"
      cancelText="Отмена"
      confirmLoading={isLoading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values: {
          decision: string
          comment: string
          conditions?: string
        }) => {
          setError(null)
          try {
            await action({
              id: verification.id,
              path: 'complete',
              body: {
                decision: values.decision,
                comment: values.comment,
                ...(values.decision === 'APPROVED_WITH_CONDITIONS'
                  ? { conditions: values.conditions }
                  : {}),
                expectedUpdatedAt: revision,
              },
            }).unwrap()
            onClose()
          } catch (cause) {
            setError(
              getApiErrorMessage(cause, 'Не удалось зафиксировать решение'),
            )
          }
        }}
      >
        <Alert
          type="info"
          showIcon
          title="Решение сохранится в истории"
          description="После завершения данные этой проверки нельзя изменить. Для нового обследования создаётся повторная проверка."
          style={{ marginBottom: 20 }}
        />
        <Form.Item
          name="decision"
          label="Решение"
          rules={[{ required: true, message: 'Выберите решение' }]}
        >
          <Select
            placeholder="Выберите решение"
            options={['APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED'].map(
              (value) => ({
                value,
                label: decisionLabels[value],
                disabled:
                  value === 'APPROVED' &&
                  verification.overallRisk !== 'NOT_IDENTIFIED',
              }),
            )}
          />
        </Form.Item>
        {decision === 'APPROVED_WITH_CONDITIONS' && (
          <Form.Item
            name="conditions"
            label="Условия согласования"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Укажите обязательные условия',
              },
            ]}
          >
            <Input.TextArea rows={3} maxLength={4000} />
          </Form.Item>
        )}
        <Form.Item
          name="comment"
          label="Обоснование решения"
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
        {error && <Alert type="error" showIcon title={error} />}
      </Form>
    </Modal>
  )
}
export function BorrowerVerificationDetailPage() {
  const { id = '' } = useParams()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])
  const select = useMemo(
    () => verificationApi.endpoints.getVerification.select(id),
    [id],
  )
  const cached = useAppSelector(select).data
  const active =
    cached?.items.some((i) => ['QUEUED', 'RUNNING'].includes(i.status)) ?? false
  const {
    data: verification,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetVerificationQuery(id, {
    skip: !id,
    pollingInterval: active ? 2000 : 0,
    skipPollingIfUnfocused: true,
    refetchOnMountOrArgChange: true,
  })
  const [action, { isLoading: acting }] = useVerificationActionMutation()
  const [notify, holder] = message.useMessage()
  const [decisionRevision, setDecisionRevision] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const autoKey = useRef(crypto.randomUUID())
  const navigate = useNavigate()
  if (isLoading)
    return (
      <AppShell title="Проверка заёмщика">
        <Skeleton active paragraph={{ rows: 12 }} />
      </AppShell>
    )
  if (error || !verification)
    return (
      <AppShell title="Проверка заёмщика">
        <Result
          status="warning"
          title="Не удалось открыть проверку"
          subTitle={getApiErrorMessage(
            error,
            'Проверка не найдена или доступ ограничен',
          )}
          extra={
            <Space>
              <Button onClick={() => void refetch()}>Повторить</Button>
              <Link to={routePaths.borrowerVerifications}>
                К списку проверок
              </Link>
            </Space>
          }
        />
      </AppShell>
    )
  const v = verification
  const required = v.items.filter((i) => i.isRequired),
    done = required.filter((i) =>
      ['COMPLETED', 'NOT_APPLICABLE'].includes(i.status),
    ).length
  const ready = v.identityVersion && done === required.length && !active
  const canAuto = v.readiness.items.some((i) => i.canRunAutomatic)
  const finalized = ['COMPLETED', 'CANCELLED'].includes(v.status)
  async function perform(path: string, body?: unknown) {
    setActionError(null)
    try {
      await action({ id, path, body }).unwrap()
      notify.success(
        path === 'submit-review'
          ? 'Проверка отправлена на согласование'
          : 'Проверка отменена',
      )
    } catch (cause) {
      let detail = ''
      if (
        cause &&
        typeof cause === 'object' &&
        'data' in cause &&
        cause.data &&
        typeof cause.data === 'object' &&
        'reasons' in cause.data &&
        Array.isArray(cause.data.reasons)
      ) {
        const labels: Record<string, string> = {
          INCOMPLETE: 'пункт не завершён',
          STALE: 'результат устарел',
          REVIEW_REQUIRED: 'нужно принять результат и разобрать совпадения',
          DOCUMENT_REVIEW_REQUIRED: 'проверьте документы',
          IDENTITY_NOT_CONFIRMED: 'подтвердите данные',
          CHECKS_RUNNING: 'дождитесь завершения запусков',
        }
        detail = cause.data.reasons
          .map((reason: unknown) => {
            const [code, state] = String(reason).split(':')
            return `${v.items.find((i) => i.checkCode === code)?.title ?? labels[code] ?? code}${state ? `: ${labels[state] ?? state}` : ''}`
          })
          .join('; ')
      }
      setActionError(
        `${getApiErrorMessage(cause, 'Не удалось выполнить действие')}${detail ? `. ${detail}` : ''}`,
      )
    }
  }
  return (
    <AppShell
      title="Проверка заёмщика"
      description="Данные, доказательства и последовательная проверка перед сделкой"
    >
      {holder}
      <div className="bv-detail-toolbar">
        <Link to={routePaths.borrowerVerifications}>
          <ArrowLeftOutlined /> Все проверки
        </Link>
        <Space wrap>
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => void refetch()}
          >
            Обновить
          </Button>
          {v.allowedActions.recheck && (
            <Button
              onClick={async () => {
                try {
                  const row = (await action({
                    id,
                    path: 'recheck',
                  }).unwrap()) as { id: string }
                  navigate(routePaths.borrowerVerification(row.id))
                } catch (cause) {
                  notify.error(
                    getApiErrorMessage(
                      cause,
                      'Не удалось создать повторную проверку',
                    ),
                  )
                }
              }}
            >
              Повторная проверка
            </Button>
          )}
        </Space>
      </div>
      <div className="bv-case-heading">
        <div>
          <div className="bv-eyebrow">
            ПРОВЕРКА ОТ {formatTime(v.createdAt)}
          </div>
          <Typography.Title level={3}>{v.party.displayName}</Typography.Title>
          <Space wrap>
            <StatusTag value={v.status} />
            <RiskTag value={v.overallRisk} />
            {v.memberRole === 'VIEWER' && <Tag>Только просмотр</Tag>}
          </Space>
        </div>
        <div className="bv-progress">
          <div className="bv-between">
            <Typography.Text type="secondary">
              Обязательные проверки
            </Typography.Text>
            <Typography.Text strong>
              {done} / {required.length}
            </Typography.Text>
          </div>
          <Progress
            percent={
              required.length ? Math.round((done / required.length) * 100) : 0
            }
            showInfo={false}
          />
        </div>
      </div>
      <Steps
        className="bv-overview-steps"
        size="small"
        current={
          v.status === 'COMPLETED'
            ? 3
            : v.status === 'READY_FOR_REVIEW'
              ? 2
              : v.identityVersion
                ? 1
                : 0
        }
        items={[
          { title: 'Подтвердить данные' },
          { title: 'Выполнить проверки' },
          { title: 'Принять решение' },
        ]}
      />
      {v.status === 'COMPLETED' && (
        <Alert
          className="bv-section"
          type={v.decision === 'REJECTED' ? 'warning' : 'success'}
          showIcon
          title={`Решение: ${decisionLabels[v.decision]}`}
          description={
            <>
              <div>{v.decisionComment}</div>
              {v.decisionConditions && (
                <div>
                  <strong>Условия:</strong> {v.decisionConditions}
                </div>
              )}
              <div>Завершено {formatTime(v.completedAt)}</div>
            </>
          }
        />
      )}
      {v.status === 'CANCELLED' && (
        <Alert
          className="bv-section"
          type="info"
          showIcon
          title="Проверка отменена"
          description="История сохранена. Можно создать повторную проверку."
        />
      )}
      <VerificationIdentityCard verification={v} />
      <VerificationDocumentsCard verification={v} />
      <Card className="bv-section bv-auto-card">
        <div className="bv-auto-content">
          <div>
            <Typography.Title level={5}>
              <PlayCircleOutlined /> Автоматические проверки
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              {v.capabilities.automaticChecks.length
                ? 'Запускаются подключённые проверки, для которых достаточно подтверждённых данных.'
                : 'Источники пока не подключены. Выполняйте проверки вручную по ссылкам в каждом пункте.'}
            </Typography.Paragraph>
            {active && (
              <Typography.Text>
                <Tag color="processing">Выполняются проверки</Tag> Результаты
                обновляются автоматически
              </Typography.Text>
            )}
          </div>
          <Tooltip
            title={
              !v.capabilities.automaticChecks.length
                ? 'Автоматические источники пока не подключены'
                : !canAuto
                  ? 'Подтвердите необходимые данные или проверьте права доступа'
                  : undefined
            }
          >
            <span>
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                disabled={!v.allowedActions.runChecks || !canAuto || active}
                loading={acting && active}
                onClick={async () => {
                  try {
                    const result = (await action({
                      id,
                      path: 'run',
                      idempotencyKey: autoKey.current,
                    }).unwrap()) as {
                      started: CheckRunResponse[]
                      skipped: { code: string }[]
                    }
                    autoKey.current = crypto.randomUUID()
                    notify.info(
                      result.started.length
                        ? `Запущено проверок: ${result.started.length}`
                        : 'Нет доступных проверок для запуска',
                    )
                  } catch (cause) {
                    notify.error(
                      getApiErrorMessage(
                        cause,
                        'Не удалось запустить автопроверки',
                      ),
                    )
                  }
                }}
              >
                Запустить автопроверки
              </Button>
            </span>
          </Tooltip>
        </div>
      </Card>
      <VerificationChecklist verification={v} />
      <VerificationRisksCard verification={v} />
      {actionError && (
        <Alert
          className="bv-section"
          type="error"
          showIcon
          title={actionError}
          closable
          onClose={() => setActionError(null)}
        />
      )}
      {!finalized && (
        <div className="bv-decision-bar">
          <div>
            <Typography.Text strong>Итог проверки</Typography.Text>
            <div className="bv-muted">
              {v.status === 'READY_FOR_REVIEW'
                ? 'Готова к решению владельца или администратора'
                : `Принято обязательных результатов: ${done} из ${required.length}`}
            </div>
          </div>
          <Space wrap>
            {v.allowedActions.edit && (
              <Popconfirm
                title="Отменить эту проверку?"
                description="История сохранится, редактирование будет закрыто."
                okText="Отменить проверку"
                cancelText="Продолжить работу"
                onConfirm={() => perform('cancel')}
              >
                <Button danger loading={acting}>
                  Отменить проверку
                </Button>
              </Popconfirm>
            )}
            {v.allowedActions.submitReview &&
              v.status !== 'READY_FOR_REVIEW' && (
                <Tooltip
                  title={
                    !ready
                      ? 'Сначала подтвердите данные и примите результаты обязательных проверок'
                      : undefined
                  }
                >
                  <span>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      disabled={!ready}
                      loading={acting}
                      onClick={() => void perform('submit-review')}
                    >
                      На согласование
                    </Button>
                  </span>
                </Tooltip>
              )}
            {v.allowedActions.complete && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => setDecisionRevision(v.updatedAt)}
              >
                Принять решение
              </Button>
            )}
          </Space>
        </div>
      )}
      {decisionRevision && (
        <FinalDecision
          verification={v}
          revision={decisionRevision}
          onClose={() => setDecisionRevision(null)}
        />
      )}
    </AppShell>
  )
}
type CheckRunResponse = { id: string }
