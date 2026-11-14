import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  DownloadOutlined,
  FileTextOutlined,
  InboxOutlined,
  LinkOutlined,
  ScanOutlined,
} from '@ant-design/icons'
import { useAppSelector } from '../../app/store/hooks'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import {
  downloadEvidence,
  useUploadVerificationEvidenceMutation,
  useVerificationActionMutation,
} from './api'
import type { Evidence, Verification } from './types'
import { authenticityLabels, evidenceKinds, formatDate } from './display'

export function EvidenceList({
  id,
  evidence,
  editable,
  compact = false,
}: {
  id: string
  evidence: Evidence[]
  editable: boolean
  compact?: boolean
}) {
  const token = useAppSelector((s) => s.auth.accessToken)
  const [review, setReview] = useState<Evidence | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [action, { isLoading }] = useVerificationActionMutation()
  const [notify, holder] = message.useMessage()
  const [downloading, setDownloading] = useState<string | null>(null)
  return (
    <>
      {holder}
      <Table<Evidence>
        rowKey="id"
        size="small"
        scroll={{ x: compact ? 600 : 650 }}
        pagination={false}
        dataSource={evidence}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Документы и ссылки пока не приложены"
            />
          ),
        }}
        columns={[
          {
            title: 'Документ / источник',
            key: 'title',
            render: (_, e) => (
              <div>
                <Typography.Text strong>{e.title}</Typography.Text>
                <div className="bv-muted">
                  {evidenceKinds[e.kind] ?? e.kind}
                  {e.issuedOn ? ` · от ${formatDate(e.issuedOn)}` : ''}
                </div>
                {e.sourceUrl && (
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LinkOutlined /> Открыть источник
                  </a>
                )}
              </div>
            ),
          },
          {
            title: 'Проверка документа',
            key: 'review',
            render: (_, e) => (
              <div>
                <Tag
                  color={
                    e.authenticityStatus === 'CONFIRMED'
                      ? 'green'
                      : ['DOUBTFUL', 'REJECTED'].includes(e.authenticityStatus)
                        ? 'orange'
                        : 'default'
                  }
                >
                  {authenticityLabels[e.authenticityStatus] ??
                    e.authenticityStatus}
                </Tag>
                {e.reviewComment && (
                  <div className="bv-muted">{e.reviewComment}</div>
                )}
              </div>
            ),
          },
          {
            title: '',
            key: 'actions',
            render: (_, e) => (
              <Space wrap>
                {e.documentId && (
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    loading={downloading === e.id}
                    onClick={async () => {
                      if (!token) return
                      setDownloading(e.id)
                      try {
                        await downloadEvidence(id, e, token)
                      } catch (cause) {
                        notify.error(
                          getApiErrorMessage(
                            cause,
                            'Не удалось скачать документ',
                          ),
                        )
                      } finally {
                        setDownloading(null)
                      }
                    }}
                  >
                    Скачать
                  </Button>
                )}
                {editable && (
                  <Button
                    size="small"
                    onClick={() => {
                      setReview(e)
                      setError(null)
                      form.resetFields()
                    }}
                  >
                    Проверить
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={Boolean(review)}
        title="Проверка документа"
        onCancel={() => setReview(null)}
        onOk={() => form.submit()}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={isLoading}
        destroyOnHidden
      >
        <Typography.Paragraph>{review?.title}</Typography.Paragraph>
        <Form
          form={form}
          preserve={false}
          layout="vertical"
          initialValues={{ status: 'CONFIRMED' }}
          onFinish={async (values: { status: string; comment: string }) => {
            if (!review) return
            try {
              await action({
                id,
                path: `evidence/${review.id}/review`,
                body: values,
              }).unwrap()
              setReview(null)
              notify.success('Результат проверки документа сохранён')
            } catch (cause) {
              setError(getApiErrorMessage(cause, 'Не удалось сохранить'))
            }
          }}
        >
          <Form.Item
            name="status"
            label="Результат"
            rules={[{ required: true }]}
          >
            <Select
              options={['CONFIRMED', 'DOUBTFUL', 'REJECTED'].map((value) => ({
                value,
                label: authenticityLabels[value],
              }))}
            />
          </Form.Item>
          <Form.Item
            name="comment"
            label="Что проверено и на чём основан вывод"
            rules={[
              {
                required: true,
                whitespace: true,
                message: 'Добавьте комментарий',
              },
            ]}
          >
            <Input.TextArea rows={3} maxLength={4000} />
          </Form.Item>
          {error && <Alert type="error" showIcon title={error} />}
        </Form>
      </Modal>
    </>
  )
}
export function VerificationDocumentsCard({
  verification,
}: {
  verification: Verification
}) {
  const [kind, setKind] = useState('PASSPORT')
  const [upload, { isLoading }] = useUploadVerificationEvidenceMutation()
  const [action, { isLoading: linkLoading }] = useVerificationActionMutation()
  const [notify, holder] = message.useMessage()
  const [linkOpen, setLinkOpen] = useState(false),
    [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm()
  const roots = verification.evidence.filter((e) => !e.runId)
  return (
    <Card
      className="bv-section"
      title={
        <Space>
          <FileTextOutlined /> Документы и источники <Tag>{roots.length}</Tag>
        </Space>
      }
      extra={
        verification.allowedActions.edit && (
          <Button
            icon={<LinkOutlined />}
            onClick={() => {
              setLinkOpen(true)
              setError(null)
            }}
          >
            Добавить ссылку
          </Button>
        )
      }
    >
      {holder}
      {verification.allowedActions.edit && (
        <div className="bv-document-upload">
          <div className="bv-upload-controls">
            <Typography.Text>Тип документа</Typography.Text>
            <Select
              value={kind}
              onChange={setKind}
              options={Object.entries(evidenceKinds)
                .filter(([value]) => value !== 'PROVIDER_RESPONSE')
                .map(([value, label]) => ({ value, label }))}
              aria-label="Тип загружаемого документа"
            />
            <Tooltip title="Распознавание паспорта пока не подключено. Данные можно ввести вручную.">
              <span>
                <Button disabled icon={<ScanOutlined />}>
                  Распознать паспорт
                </Button>
              </span>
            </Tooltip>
          </div>
          <Upload.Dragger
            accept=".pdf,.jpg,.jpeg,.png"
            multiple={false}
            showUploadList={false}
            disabled={isLoading}
            beforeUpload={(file) => {
              if (file.size > 10 * 1024 * 1024) {
                notify.error('Размер файла не должен превышать 10 МБ')
                return Upload.LIST_IGNORE
              }
              return true
            }}
            customRequest={async ({ file, onSuccess, onError }) => {
              if (!(file instanceof File)) return
              const body = new FormData()
              body.append('file', file)
              body.append('kind', kind)
              body.append('title', file.name)
              try {
                const result = await upload({
                  id: verification.id,
                  body,
                }).unwrap()
                onSuccess?.(result)
                notify.success(
                  'Документ загружен. Проверьте его перед использованием в результате.',
                )
              } catch (cause) {
                notify.error(
                  getApiErrorMessage(cause, 'Не удалось загрузить документ'),
                )
                onError?.(new Error('Не удалось загрузить документ'))
              }
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              {isLoading
                ? 'Документ загружается…'
                : 'Перетащите паспорт или другой документ'}
            </p>
            <p className="ant-upload-hint">
              Или нажмите для выбора · PDF, JPEG, PNG · до 10 МБ
            </p>
          </Upload.Dragger>
        </div>
      )}
      <EvidenceList
        id={verification.id}
        evidence={roots}
        editable={verification.allowedActions.edit}
      />
      <Modal
        open={linkOpen}
        title="Добавить источник"
        onCancel={() => setLinkOpen(false)}
        onOk={() => form.submit()}
        okText="Добавить"
        cancelText="Отмена"
        confirmLoading={linkLoading}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{ kind: 'OTHER' }}
          onFinish={async (values: {
            kind: string
            title: string
            sourceUrl: string
          }) => {
            try {
              await action({
                id: verification.id,
                path: 'evidence/links',
                body: values,
              }).unwrap()
              setLinkOpen(false)
              form.resetFields()
            } catch (cause) {
              setError(
                getApiErrorMessage(cause, 'Не удалось добавить источник'),
              )
            }
          }}
        >
          <Form.Item
            name="title"
            label="Название"
            rules={[
              { required: true, whitespace: true, message: 'Укажите название' },
            ]}
          >
            <Input maxLength={500} />
          </Form.Item>
          <Form.Item
            name="sourceUrl"
            label="Ссылка"
            rules={[
              { required: true, message: 'Укажите ссылку' },
              { type: 'url', message: 'Введите полный адрес https://…' },
            ]}
          >
            <Input placeholder="https://…" />
          </Form.Item>
          <Form.Item name="kind" label="Тип">
            <Select
              options={Object.entries(evidenceKinds).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          {error && <Alert type="error" showIcon title={error} />}
        </Form>
      </Modal>
    </Card>
  )
}
