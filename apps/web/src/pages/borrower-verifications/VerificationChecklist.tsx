import { useRef, useState } from 'react'
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  CopyOutlined,
  EditOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type {
  CheckItem,
  CheckRun,
  Finding,
  Readiness,
  Verification,
} from './types'
import {
  useGetVerificationRunQuery,
  useGetVerificationRunsQuery,
  useVerificationActionMutation,
} from './api'
import { fieldLabels, formatTime, money } from './display'
import { ResultValue, RiskTag, StatusTag } from './status-components'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { ManualResultModal } from './ManualResultModal'
import { EvidenceList } from './VerificationDocumentsCard'
import { ManualRiskModal } from './VerificationRisksCard'
const matchLabels: Record<string, string> = {
  UNKNOWN: 'Не установлено',
  POSSIBLE: 'Возможное совпадение',
  CONFIRMED: 'Наш заёмщик',
  REJECTED: 'Другой человек',
}
const resultTypes: Record<string, string> = {
  BOOLEAN: 'Да / Нет',
  CATEGORY: 'Категория',
  MONEY: 'Сумма',
  DOCUMENT: 'Документ',
  RECORD_LIST: 'Список записей',
}
function CheckPanel({
  verification,
  item,
  readiness,
}: {
  verification: Verification
  item: CheckItem
  readiness?: Readiness
}) {
  const [selected, setSelected] = useState<string>()
  const active = verification.items.some((i) =>
    ['RUNNING', 'QUEUED'].includes(i.status),
  )
  const {
    data: history = [],
    isLoading: historyLoading,
    error: historyError,
  } = useGetVerificationRunsQuery(
    { id: verification.id, itemId: item.id },
    { pollingInterval: active ? 2000 : 0, skipPollingIfUnfocused: true },
  )
  const runId =
    selected ?? history[0]?.id ?? item.runs?.[0]?.id ?? item.acceptedRunId ?? ''
  const {
    data: detail,
    isLoading: runLoading,
    error: runError,
  } = useGetVerificationRunQuery(
    { id: verification.id, itemId: item.id, runId },
    {
      skip: !runId,
      pollingInterval: active ? 2000 : 0,
      skipPollingIfUnfocused: true,
    },
  )
  const run: CheckRun | undefined =
    detail ??
    history.find((r) => r.id === runId) ??
    item.runs?.find((r) => r.id === runId) ??
    (item.acceptedRun?.id === runId ? item.acceptedRun : undefined)
  const [manualOpen, setManualOpen] = useState(false),
    [riskOpen, setRiskOpen] = useState(false)
  const [finding, setFinding] = useState<Finding | null>(null),
    [notApplicable, setNotApplicable] = useState(false)
  const [form] = Form.useForm(),
    [action, { isLoading: saving }] = useVerificationActionMutation()
  const [notify, holder] = message.useMessage()
  const [saveError, setSaveError] = useState<string | null>(null)
  const autoKey = useRef(crypto.randomUUID())
  const editable = verification.allowedActions.edit
  const i = verification.identityVersion
  return (
    <div className="bv-check-panel">
      {holder}
      <Typography.Paragraph type="secondary">
        {item.instructions}
      </Typography.Paragraph>
      <div className="bv-check-tools">
        {item.sourceUrl && (
          <Button
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            icon={<LinkOutlined />}
          >
            Открыть источник
          </Button>
        )}
        {i && (
          <Space wrap className="bv-copy-fields">
            <CopyOutlined />
            <Typography.Text
              copyable={{
                text: [i.lastName, i.firstName, i.middleName]
                  .filter(Boolean)
                  .join(' '),
              }}
            >
              ФИО
            </Typography.Text>
            {i.birthDate && (
              <Typography.Text copyable={{ text: i.birthDate.slice(0, 10) }}>
                Дата рождения
              </Typography.Text>
            )}
            {i.inn && (
              <Typography.Text copyable={{ text: i.inn }}>ИНН</Typography.Text>
            )}
            {i.passportNumber && (
              <Typography.Text
                copyable={{
                  text: `${i.passportSeries ?? ''} ${i.passportNumber}`,
                }}
              >
                Паспорт
              </Typography.Text>
            )}
          </Space>
        )}
      </div>
      {!!readiness?.missingFields.length && (
        <Alert
          type="warning"
          showIcon
          title={`Для проверки заполните: ${readiness.missingFields.map((f) => fieldLabels[f] ?? f).join(', ')}`}
          style={{ marginBottom: 16 }}
        />
      )}
      {editable && (
        <Space wrap style={{ marginBottom: 20 }}>
          <Button
            type="primary"
            icon={<EditOutlined />}
            disabled={!readiness?.canRecordManual}
            onClick={() => setManualOpen(true)}
          >
            Внести ручной результат
          </Button>
          <Tooltip
            title={
              !readiness?.automaticAvailable
                ? 'Интеграция с источником пока не подключена'
                : !readiness.canRunAutomatic
                  ? 'Проверьте данные и доступность обработки'
                  : undefined
            }
          >
            <span>
              <Button
                icon={<PlayCircleOutlined />}
                loading={saving}
                disabled={
                  !readiness?.canRunAutomatic ||
                  ['QUEUED', 'RUNNING'].includes(item.status)
                }
                onClick={async () => {
                  try {
                    const result = (await action({
                      id: verification.id,
                      path: `items/${item.id}/runs`,
                      idempotencyKey: autoKey.current,
                    }).unwrap()) as { id: string }
                    setSelected(result.id)
                    autoKey.current = crypto.randomUUID()
                    notify.success('Автопроверка поставлена в очередь')
                  } catch (cause) {
                    notify.error(
                      getApiErrorMessage(
                        cause,
                        'Не удалось запустить проверку',
                      ),
                    )
                  }
                }}
              >
                Запустить автоматически
              </Button>
            </span>
          </Tooltip>
          {!item.isRequired &&
            ['OWNER', 'ADMIN'].includes(verification.memberRole) && (
              <Button
                type="text"
                onClick={() => {
                  setNotApplicable(true)
                  setSaveError(null)
                  form.resetFields()
                }}
              >
                Не применимо
              </Button>
            )}
        </Space>
      )}
      {item.status === 'NOT_APPLICABLE' && (
        <Alert
          type="info"
          title="Проверка не применима"
          description={item.notApplicableReason}
          style={{ marginBottom: 16 }}
        />
      )}
      {(historyError || runError) && (
        <Alert
          type="error"
          showIcon
          title={getApiErrorMessage(
            historyError ?? runError,
            'Не удалось загрузить историю результатов',
          )}
          style={{ marginBottom: 16 }}
        />
      )}
      {historyLoading || runLoading ? (
        <Spin />
      ) : !run ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Проверка ещё не проводилась. Здесь появятся сохранённые результаты."
        />
      ) : (
        <div className="bv-run-result">
          {run.identityVersionId !== verification.identityVersion?.id && (
            <Alert
              type="warning"
              showIcon
              title="Результат относится к предыдущим данным"
              description="Для текущей версии данных необходимо выполнить проверку заново. Исторический результат сохранён."
              style={{ marginBottom: 16 }}
            />
          )}
          <div className="bv-between">
            <Space wrap>
              <Typography.Text strong>Результат проверки</Typography.Text>
              <StatusTag value={run.status} />
              {run.id === item.acceptedRunId && <Tag color="green">Принят</Tag>}
            </Space>
            <Select
              value={runId}
              style={{ minWidth: 240, maxWidth: '100%' }}
              aria-label="История запусков"
              onChange={setSelected}
              options={history.map((r) => ({
                value: r.id,
                label: `№ ${r.attemptNo} · ${r.mode === 'AUTOMATIC' ? 'Авто' : 'Вручную'} · ${formatTime(r.createdAt)}`,
              }))}
            />
          </div>
          {['QUEUED', 'RUNNING'].includes(run.status) ? (
            <Alert
              type="info"
              showIcon
              icon={<Spin size="small" />}
              title={
                run.status === 'QUEUED'
                  ? 'Запуск находится в очереди'
                  : 'Выполняется запрос к источнику'
              }
              description="Состояние обновляется автоматически. Результат появится здесь после ответа источника."
              style={{ marginTop: 16 }}
            />
          ) : run.status === 'FAILED' ? (
            <Alert
              type="error"
              showIcon
              title="Проверка не выполнена"
              description={
                run.errorMessage ??
                'Повторите запрос или внесите результат вручную.'
              }
              style={{ marginTop: 16 }}
            />
          ) : run.status === 'CANCELLED' ? (
            <Alert
              type="info"
              title="Запуск отменён"
              style={{ marginTop: 16 }}
            />
          ) : (
            <>
              <div className="bv-result-answer">
                <ResultValue item={item} run={run} />
                <RiskTag value={run.riskAssessment} />
              </div>
              {run.summary && (
                <Typography.Paragraph>{run.summary}</Typography.Paragraph>
              )}
              <Descriptions
                size="small"
                column={{ xs: 1, sm: 3 }}
                items={[
                  {
                    key: 'finished',
                    label: 'Проверено',
                    children: formatTime(run.finishedAt),
                  },
                  {
                    key: 'source',
                    label: 'Данные источника',
                    children: formatTime(run.sourceAsOfAt),
                  },
                  {
                    key: 'valid',
                    label: 'Актуально до',
                    children: formatTime(run.validUntil),
                  },
                ]}
              />
              {Object.keys(run.coverage ?? {}).length > 0 && (
                <Typography.Paragraph type="secondary">
                  Охват:{' '}
                  {typeof run.coverage.description === 'string'
                    ? run.coverage.description
                    : JSON.stringify(run.coverage)}
                </Typography.Paragraph>
              )}
              {!!run.findings?.length && (
                <Table<Finding>
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ x: 700 }}
                  dataSource={run.findings}
                  columns={[
                    {
                      title: 'Найденная запись',
                      key: 'record',
                      render: (_, f) => (
                        <div>
                          <Typography.Text strong>{f.title}</Typography.Text>
                          <div className="bv-muted">
                            {[
                              f.referenceNumber,
                              f.authorityName,
                              f.recordStatus,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          {f.sourceUrl && (
                            <a
                              href={f.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Открыть запись
                            </a>
                          )}
                        </div>
                      ),
                    },
                    {
                      title: 'Сумма / остаток',
                      key: 'amount',
                      render: (_, f) =>
                        money(
                          f.outstandingAmount ?? f.claimAmount,
                          f.currency ?? 'RUB',
                        ),
                    },
                    {
                      title: 'Принадлежность',
                      key: 'match',
                      render: (_, f) => (
                        <>
                          <Tag
                            color={
                              f.identityMatch === 'CONFIRMED'
                                ? 'orange'
                                : f.identityMatch === 'REJECTED'
                                  ? 'default'
                                  : 'gold'
                            }
                          >
                            {matchLabels[f.identityMatch]}
                          </Tag>
                          {f.matchComment && (
                            <div className="bv-muted">{f.matchComment}</div>
                          )}
                        </>
                      ),
                    },
                    {
                      title: '',
                      key: 'review',
                      render: (_, f) =>
                        editable && (
                          <Button
                            size="small"
                            onClick={() => {
                              setFinding(f)
                              setSaveError(null)
                              form.resetFields()
                              form.setFieldsValue({
                                identityMatch:
                                  f.identityMatch === 'UNKNOWN'
                                    ? undefined
                                    : f.identityMatch,
                                comment: f.matchComment ?? '',
                              })
                            }}
                          >
                            Уточнить
                          </Button>
                        ),
                    },
                  ]}
                />
              )}
              {!!run.evidence?.length && (
                <div style={{ marginTop: 20 }}>
                  <Typography.Title level={5}>
                    Доказательства запуска
                  </Typography.Title>
                  <EvidenceList
                    id={verification.id}
                    evidence={run.evidence}
                    editable={editable}
                    compact
                  />
                </div>
              )}
              {editable && (
                <Space wrap style={{ marginTop: 20 }}>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={saving}
                    disabled={
                      run.identityVersionId !==
                        verification.identityVersion?.id ||
                      (run.id === item.acceptedRunId &&
                        item.status === 'COMPLETED')
                    }
                    onClick={async () => {
                      try {
                        await action({
                          id: verification.id,
                          path: `items/${item.id}/runs/${run.id}/accept`,
                        }).unwrap()
                        notify.success('Результат проверен и принят')
                      } catch (cause) {
                        notify.error(
                          getApiErrorMessage(
                            cause,
                            'Не удалось принять результат',
                          ),
                        )
                      }
                    }}
                  >
                    Принять результат
                  </Button>
                  <Button
                    icon={<WarningOutlined />}
                    onClick={() => setRiskOpen(true)}
                  >
                    Добавить риск
                  </Button>
                </Space>
              )}
            </>
          )}
        </div>
      )}
      {manualOpen && (
        <ManualResultModal
          verification={verification}
          item={item}
          onClose={() => setManualOpen(false)}
          onSaved={(id) => {
            setSelected(id)
            setManualOpen(false)
            notify.success('Результат сохранён. Проверьте и примите его.')
          }}
        />
      )}
      {riskOpen && run && (
        <ManualRiskModal
          id={verification.id}
          item={item}
          run={run}
          onClose={() => setRiskOpen(false)}
        />
      )}
      <Modal
        open={Boolean(finding) || notApplicable}
        title={
          finding ? 'Принадлежность найденной записи' : 'Проверка не применима'
        }
        onCancel={() => {
          setFinding(null)
          setNotApplicable(false)
        }}
        onOk={() => form.submit()}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          onFinish={async (values: {
            identityMatch?: string
            comment?: string
            reason?: string
          }) => {
            try {
              if (finding && run)
                await action({
                  id: verification.id,
                  path: `items/${item.id}/runs/${run.id}/findings/${finding.id}/identity-review`,
                  body: {
                    identityMatch: values.identityMatch,
                    comment: values.comment,
                    matchBasis: { description: values.comment },
                  },
                }).unwrap()
              else
                await action({
                  id: verification.id,
                  path: `items/${item.id}/not-applicable`,
                  body: { reason: values.reason },
                }).unwrap()
              setFinding(null)
              setNotApplicable(false)
            } catch (cause) {
              setSaveError(getApiErrorMessage(cause, 'Не удалось сохранить'))
            }
          }}
        >
          {finding ? (
            <>
              <Typography.Paragraph>{finding.title}</Typography.Paragraph>
              <Form.Item
                name="identityMatch"
                label="Относится к заёмщику?"
                rules={[{ required: true, message: 'Выберите результат' }]}
              >
                <Select
                  options={['CONFIRMED', 'POSSIBLE', 'REJECTED'].map(
                    (value) => ({ value, label: matchLabels[value] }),
                  )}
                />
              </Form.Item>
              <Form.Item
                name="comment"
                label="По каким данным сделан вывод"
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
            </>
          ) : (
            <Form.Item
              name="reason"
              label="Почему пункт не применим"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: 'Укажите причину',
                },
              ]}
            >
              <Input.TextArea rows={3} maxLength={4000} />
            </Form.Item>
          )}
          {saveError && <Alert type="error" showIcon title={saveError} />}
        </Form>
      </Modal>
    </div>
  )
}
export function VerificationChecklist({
  verification,
}: {
  verification: Verification
}) {
  const [filter, setFilter] = useState('all')
  const shown = verification.items.filter(
    (i) =>
      filter === 'all' ||
      (filter === 'required'
        ? i.isRequired
        : !['COMPLETED', 'NOT_APPLICABLE'].includes(i.status)),
  )
  return (
    <div className="bv-checklist">
      <div className="bv-between bv-checklist-heading">
        <div>
          <Typography.Title level={4}>Проверки по этапам</Typography.Title>
          <Typography.Text type="secondary">
            Фактический ответ, источник и оценка риска сохраняются отдельно.
          </Typography.Text>
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Все' },
            { value: 'required', label: 'Обязательные' },
            { value: 'remaining', label: 'Незавершённые' },
          ]}
        />
      </div>
      <div className="bv-check-columns">
        <span>Проверка</span>
        <span>Способ</span>
        <span>Результат</span>
        <span>Состояние</span>
      </div>
      <Collapse
        className="bv-check-collapse"
        items={shown.map((item) => {
          const ready = verification.readiness.items.find(
            (r) => r.itemId === item.id,
          )
          const latest = item.runs?.[0] ?? item.acceptedRun
          return {
            key: item.id,
            label: (
              <div className="bv-check-row">
                <div className="bv-check-name">
                  <span
                    className={`bv-step-number ${item.status === 'COMPLETED' ? 'bv-step-done' : ''}`}
                  >
                    {item.status === 'COMPLETED' ? (
                      <CheckCircleOutlined />
                    ) : (
                      item.sortOrder + 1
                    )}
                  </span>
                  <div>
                    <Typography.Text strong>{item.title}</Typography.Text>
                    <div className="bv-muted">
                      {item.isRequired ? 'Обязательная' : 'Дополнительная'} ·{' '}
                      {resultTypes[item.resultType]}
                    </div>
                  </div>
                </div>
                <div className="bv-check-mode">
                  <Tag
                    color={latest?.mode === 'AUTOMATIC' ? 'blue' : 'default'}
                  >
                    {latest?.mode === 'AUTOMATIC'
                      ? 'Автоматически'
                      : ready?.automaticAvailable
                        ? 'Авто / вручную'
                        : 'Вручную'}
                  </Tag>
                  {!ready?.automaticAvailable && (
                    <span className="bv-small bv-muted">
                      Авто не подключено
                    </span>
                  )}
                </div>
                <div className="bv-check-result">
                  <ResultValue item={item} run={latest} />
                  {latest?.status === 'SUCCEEDED' &&
                    item.status !== 'STALE' && (
                      <div>
                        <RiskTag value={latest.riskAssessment} />
                      </div>
                    )}
                </div>
                <div>
                  <StatusTag value={item.status} />
                </div>
              </div>
            ),
            children: (
              <CheckPanel
                verification={verification}
                item={item}
                readiness={ready}
              />
            ),
          }
        })}
      />
    </div>
  )
}
