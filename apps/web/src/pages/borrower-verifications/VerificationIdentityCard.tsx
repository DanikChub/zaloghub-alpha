import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  EditOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useVerificationActionMutation } from './api'
import type { Identity, Verification } from './types'
import { formatDate, formatTime } from './display'
import { getApiErrorMessage } from '../../shared/lib/api-error'
const dateValue = (value?: string | null) => value?.slice(0, 10)
const address = (value: Identity['registrationAddress']) =>
  value
    ? String(
        value.full ??
          Object.values(value)
            .filter((v) => typeof v === 'string')
            .join(', '),
      )
    : ''
function IdentityEditor({
  verification,
  onClose,
}: {
  verification: Verification
  onClose: () => void
}) {
  const identity = verification.identityVersion
  const [form] = Form.useForm()
  const noMiddle = Form.useWatch('hasNoMiddleName', form)
  const [action, { isLoading }] = useVerificationActionMutation()
  const [error, setError] = useState<string | null>(null)
  const passportDocs = [
    ...new Map(
      verification.evidence
        .filter((e) => e.kind === 'PASSPORT' && e.documentId)
        .map((e) => [e.documentId, e]),
    ).values(),
  ]
  const fields = [
    ['lastName', 'Фамилия'],
    ['firstName', 'Имя'],
    ['middleName', 'Отчество'],
    ['birthDate', 'Дата рождения'],
    ['birthPlace', 'Место рождения'],
    ['passportSeries', 'Серия паспорта'],
    ['passportNumber', 'Номер паспорта'],
    ['passportIssuedOn', 'Дата выдачи'],
    ['passportIssuedBy', 'Кем выдан'],
    ['passportDepartmentCode', 'Код подразделения'],
    ['inn', 'ИНН'],
    ['snils', 'СНИЛС'],
    ['ogrnip', 'ОГРНИП'],
  ]
  return (
    <Modal
      open
      title={identity ? 'Подтвердить новую версию данных' : 'Данные заёмщика'}
      width={850}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Подтвердить данные"
      cancelText="Отмена"
      confirmLoading={isLoading}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        title="Распознавание пока не подключено"
        description="Введите реквизиты из паспорта и проверьте их перед подтверждением. Изменение данных потребует повторной проверки зависимых результатов."
        style={{ marginBottom: 20 }}
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          ...identity,
          birthDate: dateValue(identity?.birthDate),
          passportIssuedOn: dateValue(identity?.passportIssuedOn),
          registrationFull: address(identity?.registrationAddress ?? null),
          residentialFull: address(identity?.residentialAddress ?? null),
          registrationRegion: identity?.registrationAddress?.region,
          hasNoMiddleName: identity?.hasNoMiddleName ?? false,
          previousNames: identity?.previousNames ?? [],
          previousRegions: identity?.previousRegions ?? [],
        }}
        onFinish={async (values: Record<string, unknown>) => {
          const body: Record<string, unknown> = {}
          for (const [name] of fields) {
            if (
              values[name] !== undefined &&
              values[name] !== null &&
              values[name] !== ''
            )
              body[name] =
                typeof values[name] === 'string'
                  ? (values[name] as string).trim()
                  : values[name]
          }
          body.hasNoMiddleName = values.hasNoMiddleName === true
          if (body.hasNoMiddleName) delete body.middleName
          body.registrationAddress = {
            ...(identity?.registrationAddress ?? {}),
            full: values.registrationFull ?? '',
            region: values.registrationRegion ?? '',
          }
          body.residentialAddress = {
            ...(identity?.residentialAddress ?? {}),
            full: values.residentialFull ?? '',
          }
          body.previousNames = (
            (values.previousNames ?? []) as Record<string, unknown>[]
          ).map((n) =>
            Object.fromEntries(
              Object.entries(n).filter(([, v]) => v !== '' && v !== undefined),
            ),
          )
          body.previousRegions = values.previousRegions ?? []
          if (values.sourceDocumentId)
            body.sourceDocumentId = values.sourceDocumentId
          setError(null)
          try {
            await action({
              id: verification.id,
              path: 'identity',
              method: 'PUT',
              body,
            }).unwrap()
            onClose()
          } catch (cause) {
            setError(getApiErrorMessage(cause, 'Не удалось подтвердить данные'))
          }
        }}
      >
        <Row gutter={16}>
          {fields.map(([name, label]) => (
            <Col
              xs={24}
              sm={['passportIssuedBy', 'birthPlace'].includes(name) ? 24 : 12}
              key={name}
            >
              <Form.Item
                name={name}
                label={label}
                rules={[
                  ...([
                    'lastName',
                    'firstName',
                    'birthDate',
                    'passportSeries',
                    'passportNumber',
                    'passportIssuedOn',
                  ].includes(name)
                    ? [{ required: true, message: `Заполните поле «${label}»` }]
                    : []),
                  ...([
                    'passportSeries',
                    'passportNumber',
                    'inn',
                    'snils',
                    'ogrnip',
                  ].includes(name)
                    ? [
                        {
                          pattern: new RegExp(
                            `^\\d{${({ passportSeries: 4, passportNumber: 6, inn: 12, snils: 11, ogrnip: 15 } as Record<string, number>)[name]}}$`,
                          ),
                          message: 'Проверьте количество цифр, без пробелов',
                        },
                      ]
                    : []),
                  ...(name === 'passportDepartmentCode'
                    ? [{ pattern: /^\d{3}-\d{3}$/, message: 'Формат: 770-001' }]
                    : []),
                ]}
              >
                <Input
                  type={
                    ['birthDate', 'passportIssuedOn'].includes(name)
                      ? 'date'
                      : 'text'
                  }
                  disabled={name === 'middleName' && noMiddle}
                  maxLength={name === 'passportIssuedBy' ? 1000 : 500}
                  autoComplete="off"
                />
              </Form.Item>
            </Col>
          ))}
        </Row>
        <Form.Item name="hasNoMiddleName" valuePropName="checked">
          <Checkbox>Отчество отсутствует</Checkbox>
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="registrationRegion" label="Регион регистрации">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} sm={16}>
            <Form.Item name="registrationFull" label="Адрес регистрации">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="residentialFull" label="Фактический адрес">
          <Input />
        </Form.Item>
        <Form.Item name="sourceDocumentId" label="Паспорт-источник">
          <Select
            allowClear
            placeholder="Выберите загруженный паспорт"
            options={passportDocs.map((e) => ({
              value: e.documentId!,
              label: e.title,
            }))}
          />
        </Form.Item>
        <Divider>Предыдущие данные</Divider>
        <Form.List name="previousNames">
          {(names, { add, remove }) => (
            <>
              {names.map(({ key, name, ...rest }) => (
                <div className="bv-form-block" key={key}>
                  <Row gutter={12}>
                    {[
                      ['lastName', 'Прежняя фамилия'],
                      ['firstName', 'Имя'],
                      ['middleName', 'Отчество'],
                    ].map(([field, label]) => (
                      <Col xs={24} sm={8} key={field}>
                        <Form.Item
                          {...rest}
                          name={[name, field]}
                          label={label}
                          rules={
                            field !== 'middleName'
                              ? [{ required: true, message: 'Заполните поле' }]
                              : []
                          }
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                    ))}
                    <Col xs={12} sm={8}>
                      <Form.Item name={[name, 'from']} label="С даты">
                        <Input type="date" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Form.Item name={[name, 'to']} label="По дату">
                        <Input type="date" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name={[name, 'reason']}
                        label="Основание изменения"
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button
                    type="text"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => remove(name)}
                  >
                    Удалить прежние ФИО
                  </Button>
                </div>
              ))}
              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={() => add()}
              >
                Добавить прежние ФИО
              </Button>
            </>
          )}
        </Form.List>
        <Form.Item
          name="previousRegions"
          label="Прежние регионы проживания"
          style={{ marginTop: 20 }}
        >
          <Select
            mode="tags"
            tokenSeparators={[',']}
            placeholder="Введите регион и нажмите Enter"
          />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} />}
      </Form>
    </Modal>
  )
}
export function VerificationIdentityCard({
  verification,
}: {
  verification: Verification
}) {
  const [editing, setEditing] = useState(false)
  const i = verification.identityVersion
  const copy = (value?: string | null) =>
    value ? (
      <Typography.Text copyable={{ text: value }}>{value}</Typography.Text>
    ) : (
      'Не указано'
    )
  return (
    <>
      <Card
        className="bv-section"
        title={
          <Space>
            <UserOutlined /> Данные заёмщика{' '}
            {i && <Tag color="green">Подтверждены · версия {i.versionNo}</Tag>}
          </Space>
        }
        extra={
          verification.allowedActions.edit && (
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
              {i ? 'Изменить' : 'Заполнить данные'}
            </Button>
          )
        }
      >
        {!i ? (
          <div className="bv-empty-identity">
            <UserOutlined />
            <Typography.Title level={5}>
              Сначала подтвердите данные заёмщика
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              Загрузите паспорт ниже и заполните реквизиты. Без подтверждённых
              данных проверки не запускаются.
            </Typography.Paragraph>
            {verification.allowedActions.edit && (
              <Button type="primary" onClick={() => setEditing(true)}>
                Ввести данные паспорта
              </Button>
            )}
          </div>
        ) : (
          <>
            <Descriptions
              column={{ xs: 1, sm: 2, lg: 3 }}
              size="small"
              items={[
                {
                  key: 'name',
                  label: 'ФИО',
                  span: 2,
                  children: copy(
                    [i.lastName, i.firstName, i.middleName]
                      .filter(Boolean)
                      .join(' '),
                  ),
                },
                {
                  key: 'birth',
                  label: 'Дата рождения',
                  children: copy(dateValue(i.birthDate)),
                },
                {
                  key: 'passport',
                  label: 'Паспорт',
                  children: copy(
                    [i.passportSeries, i.passportNumber]
                      .filter(Boolean)
                      .join(' '),
                  ),
                },
                {
                  key: 'issued',
                  label: 'Дата выдачи',
                  children: formatDate(i.passportIssuedOn),
                },
                {
                  key: 'code',
                  label: 'Код подразделения',
                  children: copy(i.passportDepartmentCode),
                },
                {
                  key: 'issuer',
                  label: 'Кем выдан',
                  span: 3,
                  children: i.passportIssuedBy ?? 'Не указано',
                },
                {
                  key: 'place',
                  label: 'Место рождения',
                  span: 3,
                  children: i.birthPlace ?? 'Не указано',
                },
                { key: 'inn', label: 'ИНН', children: copy(i.inn) },
                { key: 'snils', label: 'СНИЛС', children: copy(i.snils) },
                { key: 'ogrnip', label: 'ОГРНИП', children: copy(i.ogrnip) },
                {
                  key: 'registration',
                  label: 'Регистрация',
                  span: 3,
                  children: copy(address(i.registrationAddress)),
                },
                {
                  key: 'residential',
                  label: 'Проживание',
                  span: 3,
                  children: copy(address(i.residentialAddress)),
                },
              ]}
            />
            {i.previousNames.length > 0 && (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                Прежние ФИО:{' '}
                {i.previousNames
                  .map((n) =>
                    [n.lastName, n.firstName, n.middleName]
                      .filter(Boolean)
                      .join(' '),
                  )
                  .join('; ')}
              </Typography.Paragraph>
            )}
            <Typography.Text type="secondary" className="bv-small">
              Подтверждены {formatTime(i.confirmedAt)}. Проверка документа
              выполняется отдельным пунктом ниже.
            </Typography.Text>
          </>
        )}
      </Card>
      {editing && (
        <IdentityEditor
          verification={verification}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
