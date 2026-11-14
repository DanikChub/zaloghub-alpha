import { useRef, useState } from 'react'
import {
  Alert,
  Button,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Typography,
} from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import type { CheckItem, Verification } from './types'
import { authenticityLabels, categoryLabels } from './display'
import { useVerificationActionMutation } from './api'
import { getApiErrorMessage } from '../../shared/lib/api-error'
const findingTypes = [
  { value: 'ENFORCEMENT', label: 'Исполнительное производство' },
  { value: 'COURT_CASE', label: 'Судебное дело' },
  { value: 'BANKRUPTCY', label: 'Банкротство' },
  { value: 'LIST_MATCH', label: 'Совпадение в перечне' },
  { value: 'OTHER', label: 'Другая запись' },
]
export function ManualResultModal({
  verification,
  item,
  onClose,
  onSaved,
}: {
  verification: Verification
  item: CheckItem
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [form] = Form.useForm()
  const [error, setError] = useState<string | null>(null)
  const key = useRef(crypto.randomUUID())
  const [action, { isLoading }] = useVerificationActionMutation()
  const sources = verification.evidence.filter((e) => !e.runId)
  const initialType =
    item.checkCode === 'FSSP'
      ? 'ENFORCEMENT'
      : item.checkCode.startsWith('BANKRUPTCY')
        ? 'BANKRUPTCY'
        : ['ARBITRATION', 'GENERAL_COURTS'].includes(item.checkCode)
          ? 'COURT_CASE'
          : 'LIST_MATCH'
  return (
    <Modal
      open
      title={`Результат: ${item.title}`}
      width={900}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Сохранить результат"
      cancelText="Отмена"
      confirmLoading={isLoading}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ findings: [], currency: 'RUB' }}
        onValuesChange={() => {
          key.current = crypto.randomUUID()
        }}
        onFinish={async (values: Record<string, unknown>) => {
          const body: Record<string, unknown> = {
            evidenceIds: values.evidenceIds,
          }
          if (item.resultType === 'BOOLEAN')
            body.resultBoolean = values.resultBoolean
          if (item.resultType === 'CATEGORY')
            body.resultCode = values.resultCode
          if (item.resultType === 'MONEY') {
            body.resultAmount = String(values.resultAmount)
            body.currency = values.currency
          }
          if (values.summary) body.summary = values.summary
          if (values.sourceAsOfAt)
            body.sourceAsOfAt = new Date(
              `${values.sourceAsOfAt}T00:00:00`,
            ).toISOString()
          if (item.resultType === 'RECORD_LIST') {
            body.coverage = { description: values.coverage }
            body.findings = (
              (values.findings ?? []) as Record<string, unknown>[]
            ).map((f) => {
              const result = Object.fromEntries(
                Object.entries(f).filter(
                  ([, v]) => v !== '' && v !== undefined && v !== null,
                ),
              )
              for (const field of ['claimAmount', 'outstandingAmount'])
                if (result[field] !== undefined)
                  result[field] = String(result[field])
              if (
                result.claimAmount === undefined &&
                result.outstandingAmount === undefined
              )
                delete result.currency
              result.matchBasis = { comment: f.matchComment ?? '' }
              return result
            })
          }
          setError(null)
          try {
            const run = (await action({
              id: verification.id,
              path: `items/${item.id}/manual-results`,
              body,
              idempotencyKey: key.current,
            }).unwrap()) as { id: string }
            onSaved(run.id)
          } catch (cause) {
            setError(
              getApiErrorMessage(cause, 'Не удалось сохранить результат'),
            )
          }
        }}
      >
        <Typography.Paragraph type="secondary">
          Запишите фактический ответ источника. Отсутствие сведений и
          невозможность выполнить проверку — разные результаты.
        </Typography.Paragraph>
        {item.resultType === 'BOOLEAN' && (
          <Form.Item
            name="resultBoolean"
            label={item.title}
            rules={[{ required: true, message: 'Выберите ответ' }]}
          >
            <Radio.Group
              options={[
                { value: true, label: 'Да' },
                { value: false, label: 'Нет' },
              ]}
            />
          </Form.Item>
        )}
        {item.resultType === 'CATEGORY' && (
          <Form.Item
            name="resultCode"
            label="Результат"
            rules={[{ required: true, message: 'Выберите результат' }]}
          >
            <Select
              placeholder="Выберите ответ источника"
              options={(item.resultSchema.categories ?? []).map((value) => ({
                value,
                label: categoryLabels[value] ?? value,
              }))}
            />
          </Form.Item>
        )}
        {item.resultType === 'MONEY' && (
          <Row gutter={16}>
            <Col xs={16}>
              <Form.Item
                name="resultAmount"
                label="Непогашенная сумма"
                rules={[
                  {
                    required: true,
                    message: 'Введите сумму, включая 0 при отсутствии долга',
                  },
                ]}
              >
                <InputNumber
                  stringMode
                  min="0"
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col xs={8}>
              <Form.Item
                name="currency"
                label="Валюта"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { value: 'RUB', label: 'Рубли' },
                    { value: 'USD', label: 'Доллары' },
                    { value: 'EUR', label: 'Евро' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        )}
        {item.resultType === 'DOCUMENT' && (
          <Alert
            type="info"
            showIcon
            title="Выберите подтверждающий документ ниже"
            description="Сам факт приложения справки не доказывает отсутствие иных рисков."
            style={{ marginBottom: 16 }}
          />
        )}
        {item.resultType === 'RECORD_LIST' && (
          <>
            <Form.Item
              name="coverage"
              label="Охват проверки"
              extra="Укажите источник, регионы, прежние ФИО и период, которые действительно проверены."
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: 'Опишите охват поиска',
                },
              ]}
            >
              <Input.TextArea
                rows={2}
                maxLength={4000}
                placeholder="Например: поиск по текущим ФИО и дате рождения во всех регионах…"
              />
            </Form.Item>
            <Divider>Найденные записи</Divider>
            <Form.List name="findings">
              {(findings, { add, remove }) => (
                <>
                  {findings.length === 0 && (
                    <Typography.Paragraph type="secondary">
                      Если поиск выполнен и совпадений нет, оставьте список
                      пустым. Сохранится результат «Совпадений не найдено в
                      пределах проверки».
                    </Typography.Paragraph>
                  )}
                  {findings.map(({ key, name, ...rest }, index) => (
                    <div className="bv-form-block" key={key}>
                      <div className="bv-between">
                        <Typography.Text strong>
                          Запись {index + 1}
                        </Typography.Text>
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                        >
                          Удалить
                        </Button>
                      </div>
                      <Form.Item {...rest} name={[name, 'recordKey']} hidden>
                        <Input />
                      </Form.Item>
                      <Row gutter={12}>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name={[name, 'findingType']}
                            label="Вид записи"
                            rules={[{ required: true }]}
                          >
                            <Select options={findingTypes} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name={[name, 'referenceNumber']}
                            label="Номер дела / производства"
                          >
                            <Input maxLength={200} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item
                        name={[name, 'title']}
                        label="Суть записи"
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: 'Опишите найденную запись',
                          },
                        ]}
                      >
                        <Input maxLength={500} />
                      </Form.Item>
                      <Row gutter={12}>
                        {[
                          ['authorityName', 'Суд / орган'],
                          ['personRole', 'Роль заёмщика'],
                          ['recordStatus', 'Статус дела'],
                        ].map(([field, label]) => (
                          <Col xs={24} sm={8} key={field}>
                            <Form.Item name={[name, field]} label={label}>
                              <Input maxLength={200} />
                            </Form.Item>
                          </Col>
                        ))}
                        <Col xs={12} sm={8}>
                          <Form.Item
                            name={[name, 'claimAmount']}
                            label="Сумма требований"
                          >
                            <InputNumber
                              stringMode
                              min="0"
                              precision={2}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={12} sm={8}>
                          <Form.Item
                            name={[name, 'outstandingAmount']}
                            label="Остаток долга"
                          >
                            <InputNumber
                              stringMode
                              min="0"
                              precision={2}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Form.Item name={[name, 'currency']} label="Валюта">
                            <Select
                              options={[{ value: 'RUB', label: 'Рубли' }]}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item
                        name={[name, 'sourceUrl']}
                        label="Ссылка на запись"
                        rules={[
                          {
                            type: 'url',
                            message: 'Введите полный адрес https://…',
                          },
                        ]}
                      >
                        <Input placeholder="https://…" />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'identityMatch']}
                        label="Запись относится к заёмщику?"
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={[
                            { value: 'UNKNOWN', label: 'Пока не установлено' },
                            {
                              value: 'POSSIBLE',
                              label: 'Возможное совпадение',
                            },
                            {
                              value: 'CONFIRMED',
                              label: 'Да, принадлежность подтверждена',
                            },
                            { value: 'REJECTED', label: 'Нет, другой человек' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'matchComment']}
                        label="Основание совпадения / примечание"
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message:
                              'Укажите, какие идентификаторы удалось сопоставить',
                          },
                        ]}
                      >
                        <Input.TextArea rows={2} maxLength={4000} />
                      </Form.Item>
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({
                        recordKey: crypto.randomUUID(),
                        findingType: initialType,
                        identityMatch: 'UNKNOWN',
                        currency: 'RUB',
                      })
                    }
                  >
                    Добавить найденную запись
                  </Button>
                </>
              )}
            </Form.List>
          </>
        )}
        <Divider>Подтверждение результата</Divider>
        <Form.Item
          name="evidenceIds"
          label="Документы и источники"
          extra={
            item.resultSchema.documentRequired
              ? 'Для этого пункта требуется файл — одной ссылки недостаточно.'
              : 'Прикрепите документ, скриншот или ссылку, подтверждающие результат.'
          }
          rules={[
            { required: true, message: 'Выберите хотя бы одно доказательство' },
          ]}
        >
          <Select
            mode="multiple"
            placeholder="Выберите из загруженных документов"
            optionFilterProp="label"
            options={sources.map((e) => ({
              value: e.id,
              label: `${e.title} · ${authenticityLabels[e.authenticityStatus]}`,
            }))}
          />
        </Form.Item>
        {sources.length === 0 && (
          <Alert
            type="warning"
            showIcon
            title="Сначала добавьте документ или ссылку в блоке «Документы и источники»"
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item name="sourceAsOfAt" label="Сведения актуальны на дату">
          <Input type="date" />
        </Form.Item>
        <Form.Item name="summary" label="Комментарий к результату">
          <Input.TextArea rows={3} maxLength={4000} />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} />}
      </Form>
    </Modal>
  )
}
