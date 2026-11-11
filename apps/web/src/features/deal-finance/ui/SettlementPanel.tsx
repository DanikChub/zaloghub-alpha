import { useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import type { Deal } from '../../../entities/deal/model/types'
import type { FinanceInstruction, SettlementQuote } from '../../../entities/deal/model/finance.types'
import {
  useAgreeSettlementMutation,
  useCalculateSettlementMutation,
  useCancelSettlementMutation,
  useExecuteSettlementMutation,
} from '../../../entities/deal/api/financeApi'
import { date, money } from '../../../entities/deal/lib/format'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { today, useRequestKey } from '../model/helpers'

export function SettlementPanel({ deal }: { deal: Deal }) {
  const [calculate, calculateState] = useCalculateSettlementMutation()
  const [agree, agreeState] = useAgreeSettlementMutation()
  const [execute, executeState] = useExecuteSettlementMutation()
  const [cancel, cancelState] = useCancelSettlementMutation()
  const [on, setOn] = useState(dayjs())
  const [quote, setQuote] = useState<SettlementQuote | null>(null)
  const [reference, setReference] = useState('')
  const [accepted, setAccepted] = useState(false)
  const request = useRequestKey()
  const [notify, holder] = message.useMessage()
  const instructions = (deal.financeInstructions ?? []).filter((i) => i.kind === 'SETTLEMENT')
  const closed = instructions.find((i) => i.status === 'EXECUTED')
  const calculateQuote = async () => {
    try {
      const result = await calculate({ dealId: deal.id, date: on.format('YYYY-MM-DD') }).unwrap()
      setQuote(result)
      setAccepted(false)
    } catch (e) {
      setQuote(null)
      notify.error(getApiErrorMessage(e, 'Не удалось рассчитать закрытие'))
    }
  }
  const saveAgreement = async () => {
    if (!quote || !accepted || !reference.trim()) return
    const body = { date: quote.on, quoteHash: quote.quoteHash, agreementReference: reference.trim() }
    try {
      await agree({ dealId: deal.id, ...body, idempotencyKey: request.key(body) }).unwrap()
      request.reset()
      setQuote(null)
      setReference('')
      setAccepted(false)
      notify.success('Соглашение сохранено. Тело пока не погашено')
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Не удалось сохранить соглашение'))
    }
  }
  const executeAgreement = async (row: FinanceInstruction) => {
    try {
      await execute({ dealId: deal.id, instructionId: row.id, date: row.effectiveOn.slice(0, 10) }).unwrap()
      notify.success('Займ закрыт, дальнейшие начисления прекращены')
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Не удалось выполнить закрытие'))
    }
  }
  return (
    <>
      {holder}
      {closed ? (
        <Alert type="success" title={`Согласованное закрытие выполнено ${date(closed.executedOn)}.`} />
      ) : (
        <>
          <Alert
            type="info"
            title="Перевод тела сам по себе не закрывает займ. Сначала рассчитайте сумму и зафиксируйте согласование. Исполнение доступно после регистрации реальных поступлений."
          />
          <Space wrap style={{ margin: '16px 0' }}>
            <DatePicker
              value={on}
              allowClear={false}
              disabled={calculateState.isLoading || agreeState.isLoading}
              onChange={(v) => {
                if (v) {
                  setOn(v)
                  setQuote(null)
                  setAccepted(false)
                }
              }}
              format="DD.MM.YYYY"
            />
            <Button type="primary" loading={calculateState.isLoading} onClick={calculateQuote}>
              Рассчитать закрытие на дату
            </Button>
          </Space>
          {quote && (
            <>
              <Typography.Title level={5}>Расчёт на конец {date(quote.on)}</Typography.Title>
              <Descriptions
                bordered
                size="small"
                column={{ xs: 1, md: 2 }}
                items={[
                  { key: 'principal', label: 'Остаток тела', children: money(quote.principal) },
                  { key: 'target', label: 'Проценты по условиям закрытия', children: money(quote.interestTarget) },
                  { key: 'paid', label: 'Уже оплачено процентов', children: money(quote.interestPaid) },
                  { key: 'interest', label: 'Осталось оплатить процентов', children: money(quote.interestRemaining) },
                  {
                    key: 'minimum',
                    label: 'Минимум за мораторий',
                    children: quote.insideMoratorium ? money(quote.minimumInterestTotal) : 'Мораторий закончился',
                  },
                  { key: 'penalty', label: 'Неустойка', children: money(quote.penalty) },
                  { key: 'total', label: 'К закрытию до зачёта остатка', children: money(quote.amountToClose) },
                  { key: 'held', label: 'Уже есть для закрытия', children: money(quote.availableForSettlement) },
                  {
                    key: 'extra',
                    label: 'Нужно дополнительно перевести',
                    children: <strong>{money(quote.additionalPaymentRequired)}</strong>,
                  },
                ]}
              />
              <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                Запросы возврата из этих средств не расходуются. Во время моратория ранее оплаченные проценты
                засчитываются в установленный минимум.
              </Typography.Paragraph>
              <Input.TextArea
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Основание согласования с заёмщиком: переписка, звонок или соглашение"
                maxLength={1000}
                disabled={agreeState.isLoading}
              />
              <Space wrap style={{ margin: '12px 0' }}>
                <Checkbox
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  disabled={agreeState.isLoading}
                >
                  Условия и дата закрытия согласованы с заёмщиком
                </Checkbox>
                <Button
                  type="primary"
                  loading={agreeState.isLoading}
                  disabled={!accepted || !reference.trim()}
                  onClick={saveAgreement}
                >
                  Зафиксировать соглашение
                </Button>
              </Space>
            </>
          )}
        </>
      )}
      <Typography.Title level={5}>Соглашения о закрытии</Typography.Title>
      <Table<FinanceInstruction>
        rowKey="id"
        size="small"
        dataSource={instructions}
        pagination={{ pageSize: 5 }}
        scroll={{ x: 650 }}
        locale={{ emptyText: 'Соглашений пока нет' }}
        columns={[
          { title: 'Дата закрытия', dataIndex: 'effectiveOn', render: date },
          { title: 'К закрытию при согласовании', render: (_, row) => money(row.payload.amountToClose ?? '0') },
          { title: 'Основание', render: (_, row) => row.payload.agreementReference || '—' },
          {
            title: 'Состояние',
            render: (_, row) => (
              <Tag color={row.status === 'EXECUTED' ? 'green' : row.status === 'CANCELLED' ? 'default' : 'gold'}>
                {row.status === 'EXECUTED' ? 'Исполнено' : row.status === 'CANCELLED' ? 'Отменено' : 'Согласовано'}
              </Tag>
            ),
          },
          {
            title: '',
            render: (_, row) =>
              row.status === 'AGREED' && (
                <Space>
                  <Popconfirm
                    title="Исполнить согласованное закрытие?"
                    description="Поступившие деньги будут направлены на закрытие. При нехватке средств операция не выполнится."
                    onConfirm={() => executeAgreement(row)}
                  >
                    <Button
                      type="primary"
                      size="small"
                      loading={executeState.isLoading}
                      disabled={dayjs(row.effectiveOn).isAfter(dayjs(), 'day') || !!closed}
                    >
                      Исполнить
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title="Отменить неисполненное соглашение?"
                    onConfirm={async () => {
                      try {
                        await cancel({ dealId: deal.id, instructionId: row.id, date: today() }).unwrap()
                        notify.success('Соглашение отменено')
                      } catch (e) {
                        notify.error(getApiErrorMessage(e, 'Не удалось отменить соглашение'))
                      }
                    }}
                  >
                    <Button size="small" loading={cancelState.isLoading}>
                      Отменить
                    </Button>
                  </Popconfirm>
                </Space>
              ),
          },
        ]}
      />
      {!closed && instructions.some((i) => i.status === 'AGREED') && (
        <Typography.Paragraph type="secondary">
          Недостающую сумму добавьте через «Добавить платёж» в карточке сделки, затем исполните соглашение. Если дата
          или обязательства изменились, получите новый расчёт и согласуйте его заново.
        </Typography.Paragraph>
      )}
    </>
  )
}
