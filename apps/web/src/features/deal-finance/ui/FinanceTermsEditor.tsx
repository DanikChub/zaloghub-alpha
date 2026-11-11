import { useRef, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import type { Deal } from '../../../entities/deal/model/types'
import type { LoanTerms } from '../../../entities/deal/model/finance.types'
import {
  useExtendDealCalendarMutation,
  useGetFinanceTermsQuery,
  useGetRussianCalendarsQuery,
  useImportRussianCalendarMutation,
  usePreviewFinanceTermsMutation,
  useSaveFinanceTermsMutation,
} from '../../../entities/deal/api/financeApi'
import type { FinanceTermsPreview } from '../../../entities/deal/api/financeApi'
import { date, money } from '../../../entities/deal/lib/format'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { fallbackTerms, fromValues, nextPayment, toValues, type TermsValues } from '../model/terms-form'

export function FinanceTermsEditor({ deal }: { deal: Deal }) {
  const { data, error, isLoading, refetch } = useGetFinanceTermsQuery(deal.id)
  const { data: calendars = [] } = useGetRussianCalendarsQuery()
  const [previewTerms, previewState] = usePreviewFinanceTermsMutation()
  const [saveTerms, saveState] = useSaveFinanceTermsMutation()
  const [importCalendar, importState] = useImportRussianCalendarMutation()
  const [extendCalendar, extendState] = useExtendDealCalendarMutation()
  const [form] = Form.useForm<TermsValues>()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<FinanceTermsPreview | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [year, setYear] = useState(dayjs())
  const source = useRef<LoanTerms | null>(null)
  const [notify, holder] = message.useMessage()
  const penalty = Form.useWatch('penalty', form),
    increase = Form.useWatch('increase', form),
    loss = Form.useWatch('loss', form),
    moratorium = Form.useWatch('moratorium', form),
    settlement = Form.useWatch('settlement', form)
  const busy = previewState.isLoading || saveState.isLoading
  const initialOrder = data?.terms?.allocation.componentOrder.join(',') ?? 'PENALTY,INTEREST,PRINCIPAL,EXPENSE'
  const orders = [
    ...new Set(['PENALTY,INTEREST,PRINCIPAL,EXPENSE', 'INTEREST,PENALTY,PRINCIPAL,EXPENSE', initialOrder]),
  ]
  const labels: Record<string, string> = {
    PENALTY: 'Пени',
    INTEREST: 'Проценты',
    PRINCIPAL: 'Тело',
    EXPENSE: 'Расходы',
  }
  const openEditor = () => {
    source.current = data?.terms ?? data?.suggestedTerms ?? fallbackTerms(deal)
    form.resetFields()
    form.setFieldsValue(toValues(source.current, deal))
    setPreview(null)
    setAccepted(false)
    setOpen(true)
  }
  const calculate = async (values: TermsValues) => {
    try {
      const result = await previewTerms({ dealId: deal.id, terms: fromValues(values, source.current!) }).unwrap()
      setPreview(result)
      setAccepted(false)
    } catch (e) {
      notify.error(getApiErrorMessage(e, e instanceof Error ? e.message : 'Не удалось проверить условия'))
    }
  }
  const save = async () => {
    if (!preview || !accepted) return
    try {
      await saveTerms({ dealId: deal.id, terms: preview.terms, confirmationHash: preview.confirmationHash }).unwrap()
      setOpen(false)
      notify.success('Условия сохранены. Расчёт обновлён')
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Не удалось сохранить условия'))
    }
  }
  const number = (name: keyof TermsValues, label: string, integer = false, min = 0, max?: number) => (
    <Col xs={24} md={8}>
      <Form.Item name={name} label={label} rules={[{ required: true }]}>
        {integer ? (
          <InputNumber min={min} max={max} precision={0} style={{ width: '100%' }} />
        ) : (
          <InputNumber<string>
            stringMode
            min={String(min)}
            precision={name === 'amount' ? 2 : 8}
            style={{ width: '100%' }}
          />
        )}
      </Form.Item>
    </Col>
  )
  const choice = (name: keyof TermsValues, label: string, options: { value: string; label: string }[]) => (
    <Col xs={24} md={12}>
      <Form.Item name={name} label={label} rules={[{ required: true }]}>
        <Select options={options} />
      </Form.Item>
    </Col>
  )
  const toggle = (name: keyof TermsValues, label: string) => (
    <Form.Item name={name} label={label} valuePropName="checked">
      <Switch />
    </Form.Item>
  )
  return (
    <>
      {holder}
      {isLoading && <Spin />}
      {error && (
        <Alert
          type="error"
          title={getApiErrorMessage(error, 'Не удалось загрузить условия')}
          action={<Button onClick={() => refetch()}>Повторить</Button>}
        />
      )}
      <Space wrap style={{ marginBottom: 16 }}>
        <Tag color={data?.terms ? 'green' : 'gold'}>
          {data?.terms ? 'Условия подтверждены' : 'Условия не настроены'}
        </Tag>
        <Button type="primary" onClick={openEditor} disabled={isLoading || !!error}>
          {data?.terms ? 'Изменить финансовые условия' : 'Настроить финансовые условия'}
        </Button>
      </Space>
      {!data?.terms && !isLoading && (
        <Alert
          type="info"
          title="Задайте правила договора и проверьте описание перед сохранением. Настройки применяются ко всей истории сделки."
        />
      )}
      {data?.description?.length ? (
        <ul>
          {data.description.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {data?.terms?.rateLoss && (
        <Alert
          type="info"
          title={`Календарь РФ покрывает ${date(data.terms.rateLoss.calendar?.fromOn)} — ${date(data.terms.rateLoss.calendar?.toOn)}. Праздники, переносы и рабочие субботы учтены.`}
        />
      )}
      <Divider>Российский производственный календарь</Divider>
      <Space wrap>
        <DatePicker
          picker="year"
          value={year}
          allowClear={false}
          onChange={(value) => {
            if (value) setYear(value)
          }}
          disabledDate={(d) => d.year() < 2013 || d.year() > dayjs().year() + 1}
        />
        <Button
          loading={importState.isLoading}
          onClick={async () => {
            try {
              await importCalendar({ year: year.year(), refresh: true }).unwrap()
              notify.success('Версия календаря проверена и сохранена')
            } catch (e) {
              notify.error(getApiErrorMessage(e, 'Не удалось загрузить календарь'))
            }
          }}
        >
          Обновить календарь РФ
        </Button>
        {data?.terms?.rateLoss && (
          <Button
            loading={extendState.isLoading}
            onClick={async () => {
              try {
                await extendCalendar({ dealId: deal.id, asOfOn: year.endOf('year').format('YYYY-MM-DD') }).unwrap()
                notify.success('Покрытие договора расширено')
              } catch (e) {
                notify.error(getApiErrorMessage(e, 'Не удалось расширить покрытие'))
              }
            }}
          >
            Расширить покрытие договора
          </Button>
        )}
      </Space>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        Опубликованы годы: {[...new Set(calendars.map((c) => c.year))].sort().join(', ') || 'пока нет'}. Обновление
        источника сохраняет новую версию; прежние версии договора остаются закреплёнными.
      </Typography.Paragraph>
      <Modal
        title="Финансовые условия договора"
        open={open}
        onCancel={() => {
          if (!busy) setOpen(false)
        }}
        width={980}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
        forceRender
        footer={
          <Space wrap>
            <Button onClick={() => setOpen(false)} disabled={busy}>
              Закрыть
            </Button>
            <Button onClick={() => form.submit()} loading={previewState.isLoading} disabled={saveState.isLoading}>
              Проверить и рассчитать
            </Button>
            <Button
              type="primary"
              onClick={save}
              loading={saveState.isLoading}
              disabled={!preview || !accepted || previewState.isLoading}
            >
              Подтвердить и сохранить
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          disabled={busy}
          onFinish={calculate}
          onValuesChange={(changed) => {
            setPreview(null)
            setAccepted(false)
            if (changed.start || changed.paymentDay) {
              const v = form.getFieldsValue()
              if (v.start && v.paymentDay) form.setFieldValue('first', nextPayment(v.start, v.paymentDay))
            }
          }}
        >
          <Divider>Сумма и график</Divider>
          <Row gutter={16}>
            {number('amount', 'Сумма договора, ₽', false, 0.01)}
            {number('rate', 'Ставка, % в месяц')}
            {number('paymentDay', 'День платежа', true, 1, 31)}
            {(
              [
                ['start', 'Начало начисления'],
                ['first', 'Первый платёж'],
                ['maturity', 'Возврат тела по сроку'],
              ] as const
            ).map(([name, label]) => (
              <Col xs={24} md={8} key={name}>
                <Form.Item name={name} label={label} rules={[{ required: true }]}>
                  <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            ))}
            {choice('divisor', 'Как рассчитывать дневную ставку', [
              { value: 'FIXED_30_DAYS', label: 'Месячная ставка / 30' },
              { value: 'CALENDAR_MONTH_DAYS', label: 'Месячная ставка / дни календарного месяца' },
            ])}
            {choice('missingDay', 'Если дня платежа нет в месяце', [
              { value: 'LAST_DAY_OF_MONTH', label: 'Последний день месяца' },
              { value: 'REJECT', label: 'Требовать исправления графика' },
            ])}
            {choice('rounding', 'Округление до копеек', [
              { value: 'HALF_UP', label: 'Половина копейки вверх' },
              { value: 'HALF_EVEN', label: 'Половина к чётной копейке' },
              { value: 'DOWN', label: 'Отбрасывать доли копейки' },
            ])}
            {choice(
              'order',
              'Порядок погашения',
              orders.map((value) => ({
                value,
                label: value
                  .split(',')
                  .map((k) => labels[k])
                  .join(' → '),
              })),
            )}
            {choice('earlyInterest', 'Проценты до срока платежа', [
              { value: 'CURRENT_PERIOD', label: 'Оплачивать текущий период' },
              { value: 'NONE', label: 'Оставлять до решения инвестора' },
            ])}
            {choice('earlyPrincipal', 'Обычный досрочный возврат тела', [
              { value: 'BLOCKED', label: 'Только через согласованное закрытие' },
              { value: 'ALLOWED', label: 'Разрешить после моратория' },
            ])}
          </Row>
          <Divider>Просрочка и ставка</Divider>
          {toggle('loss', 'Потеря льготной ставки при нарушении')}
          {loss && (
            <>
              <Row gutter={16}>
                {number('standardRate', 'Ставка после потери льготы, %/мес.')}
                {number('graceDays', 'Допустимая просрочка, рабочих дней', true, 0, 366)}
              </Row>
              {toggle('partialTriggers', 'Неполная оплата к сроку тоже прекращает льготу')}
              <Alert
                type="info"
                title="Перерасчёт начинается с месяца нарушения. Российский календарь загрузит сервер."
              />
            </>
          )}
          {toggle('penalty', 'Начислять неустойку')}
          {penalty && (
            <>
              <Row gutter={16}>
                {number('penaltyRate', 'Неустойка, % в день')}
                {choice('penaltyBase', 'База неустойки', [
                  { value: 'CONTRACT_AMOUNT', label: 'Сумма договора' },
                  { value: 'OUTSTANDING_PRINCIPAL', label: 'Остаток тела' },
                  { value: 'OVERDUE_BALANCE', label: 'Просроченные проценты и тело' },
                ])}
                {choice('paymentDayPenalty', 'День погашения просрочки', [
                  { value: 'INCLUDED', label: 'Включать в неустойку' },
                  { value: 'EXCLUDED', label: 'Исключать при полном погашении' },
                ])}
              </Row>
              {toggle('increase', 'Повышать неустойку при длительной просрочке')}
              {increase && (
                <>
                  <Row gutter={16}>
                    {number('increasedRate', 'Повышенная неустойка, %/день')}
                    {number('increaseMonths', 'Через календарных месяцев', true, 1, 1200)}
                  </Row>
                  {toggle('retrospective', 'Пересчитать повышенную пеню с начала просрочки')}
                </>
              )}
            </>
          )}
          <Divider>Мораторий и согласованное закрытие</Divider>
          {toggle('moratorium', 'Установлен мораторий на обычный возврат тела')}
          {moratorium && (
            <>
              <Form.Item name="moratoriumEnd" label="Мораторий до" rules={[{ required: true }]}>
                <DatePicker format="DD.MM.YYYY" />
              </Form.Item>
              {toggle('settlement', 'Разрешить согласованное полное закрытие с минимумом процентов')}
              {settlement && (
                <Row gutter={16}>
                  {number('minimumRate', 'Ставка для минимума, %/мес.')}
                  {number('minimumMonths', 'Минимум процентов за месяцев', true, 1, 1200)}
                </Row>
              )}
            </>
          )}
        </Form>
        {preview && (
          <>
            <Divider>Проверьте перед сохранением</Divider>
            <ul>
              {preview.description.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {preview.finance.status === 'READY' && (
              <Descriptions
                size="small"
                items={[
                  { key: 'now', label: 'К оплате сейчас', children: money(preview.finance.snapshot.dueNow) },
                  { key: 'penalty', label: 'Неустойка', children: money(preview.finance.penaltyOutstanding) },
                  {
                    key: 'next',
                    label: 'Следующий платёж',
                    children: `${date(preview.finance.snapshot.nextPaymentOn)} · ${preview.finance.snapshot.nextPaymentAmount ? money(preview.finance.snapshot.nextPaymentAmount) : '—'}`,
                  },
                ]}
              />
            )}
            <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={busy}>
              Проверил описание и подтверждаю эти условия
            </Checkbox>
          </>
        )}
      </Modal>
    </>
  )
}
