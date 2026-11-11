import { useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { Deal } from '../../../entities/deal/model/types'
import type { CreditProposal, FinanceInstruction, ReceiptCredit } from '../../../entities/deal/model/finance.types'
import {
  useAgreeCreditMutation,
  useCancelCreditInstructionMutation,
  useConfirmCreditRefundMutation,
  useGetCreditBalanceQuery,
  usePreviewCreditMutation,
  useRequestCreditRefundMutation,
} from '../../../entities/deal/api/financeApi'
import { date, money } from '../../../entities/deal/lib/format'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { today, useRequestKey } from '../model/helpers'

interface Values {
  amount: string
  date: Dayjs
  comment?: string
  agreementReference?: string
}
export function CreditManagement({ deal }: { deal: Deal }) {
  const { data, isLoading, error, refetch } = useGetCreditBalanceQuery(deal.id)
  const [refund, refundState] = useRequestCreditRefundMutation()
  const [confirmRefund, confirmState] = useConfirmCreditRefundMutation()
  const [cancel, cancelState] = useCancelCreditInstructionMutation()
  const [previewCredit, previewState] = usePreviewCreditMutation()
  const [agreeCredit, agreeState] = useAgreeCreditMutation()
  const [form] = Form.useForm<Values>()
  const [confirmationForm] = Form.useForm<{ date: Dayjs; transferReference: string }>()
  const [selection, setSelection] = useState<{ credit: ReceiptCredit; mode: 'REFUND' | 'CREDIT' } | null>(null)
  const [confirmation, setConfirmation] = useState<FinanceInstruction | null>(null)
  const [proposal, setProposal] = useState<CreditProposal | null>(null)
  const [accepted, setAccepted] = useState(false)
  const request = useRequestKey()
  const [notify, holder] = message.useMessage()
  const busy = refundState.isLoading || previewState.isLoading || agreeState.isLoading
  const instructions = (deal.financeInstructions ?? []).filter((i) => i.kind !== 'SETTLEMENT')
  const sourceLabel = (receiptId: string) => {
    const p = deal.payments.find((p) => p.id === receiptId)
    return p ? `${date(p.paidAt)} · ${money(p.amount)}` : 'Исходное поступление'
  }
  const open = (credit: ReceiptCredit, mode: 'REFUND' | 'CREDIT') => {
    form.resetFields()
    form.setFieldsValue({ amount: credit.availableAmount, date: dayjs() })
    setProposal(null)
    setAccepted(false)
    setSelection({ credit, mode })
  }
  const submit = async (values: Values) => {
    if (!selection) return
    try {
      if (selection.mode === 'REFUND') {
        const body = {
          receiptId: selection.credit.receiptId,
          amount: values.amount,
          date: values.date.format('YYYY-MM-DD'),
          comment: values.comment,
        }
        await refund({ dealId: deal.id, ...body, idempotencyKey: request.key({ kind: 'REFUND', ...body }) }).unwrap()
        notify.success('Возврат запрошен. Сумма зарезервирована до подтверждения перевода')
      } else {
        if (!proposal || !accepted) return
        const body = {
          receiptId: selection.credit.receiptId,
          date: values.date.format('YYYY-MM-DD'),
          targets: proposal.targets,
          agreementReference: values.agreementReference!.trim(),
        }
        await agreeCredit({
          dealId: deal.id,
          ...body,
          idempotencyKey: request.key({ kind: 'CREDIT', ...body }),
        }).unwrap()
        notify.success('Зачёт согласован. Средства закреплены за выбранными периодами')
      }
      request.reset()
      setSelection(null)
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Не удалось сохранить решение'))
    }
  }
  const propose = async () => {
    try {
      const v = await form.validateFields(['amount', 'date'])
      const result = await previewCredit({
        dealId: deal.id,
        receiptId: selection!.credit.receiptId,
        amount: v.amount,
        date: v.date.format('YYYY-MM-DD'),
      }).unwrap()
      setProposal(result)
      setAccepted(false)
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      notify.error(getApiErrorMessage(e, 'Не удалось предложить зачёт'))
    }
  }
  const performCancel = async (row: FinanceInstruction) => {
    try {
      await cancel({
        dealId: deal.id,
        instructionId: row.id,
        kind: row.kind as 'REFUND' | 'CREDIT',
        date: today(),
      }).unwrap()
      notify.success('Решение отменено, свободный остаток пересчитан')
    } catch (e) {
      notify.error(getApiErrorMessage(e, 'Не удалось отменить решение'))
    }
  }
  const canCancelCredit = (row: FinanceInstruction) =>
    row.payload.targets?.every((t) =>
      data?.creditReservations.some(
        (r) => r.instructionId === row.id && r.obligationKey === t.obligationKey && r.amount === t.amount,
      ),
    ) ?? false
  return (
    <>
      {holder}
      <Alert
        type="info"
        title="Лишние деньги не гасят тело и будущие месяцы автоматически. Основной вариант — вернуть остаток. Зачёт будущих процентов требует согласования с заёмщиком."
      />
      {isLoading && <Spin />}
      {error && (
        <Alert
          type="error"
          title={getApiErrorMessage(error, 'Не удалось загрузить переплату')}
          action={<Button onClick={() => refetch()}>Повторить</Button>}
        />
      )}
      {data && (
        <>
          <Descriptions
            style={{ marginTop: 16 }}
            items={[
              { key: 'available', label: 'Можно распорядиться', children: money(data.availableCredit) },
              { key: 'reserved', label: 'Зарезервировано', children: money(data.reservedCredit) },
              { key: 'returned', label: 'Фактически возвращено', children: money(data.refundedTotal) },
            ]}
          />
          <Table<ReceiptCredit>
            size="small"
            rowKey="receiptId"
            dataSource={data.credits.filter((c) => Number(c.remainingAmount) > 0 || Number(c.refundedAmount) > 0)}
            pagination={false}
            locale={{ emptyText: 'Свободных остатков и возвратов пока нет' }}
            scroll={{ x: 750 }}
            columns={[
              { title: 'Поступление', render: (_, row) => sourceLabel(row.receiptId) },
              { title: 'Свободно', dataIndex: 'availableAmount', render: money },
              { title: 'На возврат', dataIndex: 'reservedForRefund', render: money },
              { title: 'На будущие проценты', dataIndex: 'reservedForFuture', render: money },
              { title: 'Возвращено', dataIndex: 'refundedAmount', render: money },
              {
                title: 'Решение',
                render: (_, row) => (
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      disabled={Number(row.availableAmount) <= 0}
                      onClick={() => open(row, 'REFUND')}
                    >
                      Вернуть
                    </Button>
                    <Button
                      size="small"
                      disabled={Number(row.availableAmount) <= 0}
                      onClick={() => open(row, 'CREDIT')}
                    >
                      Согласовать зачёт
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </>
      )}
      <Typography.Title level={5}>Решения по остаткам</Typography.Title>
      <Table<FinanceInstruction>
        size="small"
        rowKey="id"
        dataSource={instructions}
        pagination={{ pageSize: 5 }}
        scroll={{ x: 750 }}
        columns={[
          { title: 'Дата', dataIndex: 'effectiveOn', render: date },
          {
            title: 'Действие',
            render: (_, row) =>
              row.kind === 'REFUND'
                ? `Возврат ${money(row.payload.amount ?? '0')}`
                : `Зачёт: ${row.payload.targets?.map((t) => `${date(t.obligationKey.slice(9))} — ${money(t.amount)}`).join('; ')}`,
          },
          {
            title: 'Состояние',
            render: (_, row) => (
              <Tag color={row.status === 'EXECUTED' ? 'green' : row.status === 'CANCELLED' ? 'default' : 'gold'}>
                {row.status === 'EXECUTED'
                  ? `Исполнено ${date(row.executedOn)}`
                  : row.status === 'CANCELLED'
                    ? 'Отменено'
                    : row.kind === 'REFUND'
                      ? 'Ожидает перевода'
                      : canCancelCredit(row)
                        ? 'Зарезервировано'
                        : 'Зачёт применяется по периодам'}
              </Tag>
            ),
          },
          {
            title: 'Подтверждение',
            render: (_, row) => row.executionReference ?? row.payload.agreementReference ?? '—',
          },
          {
            title: '',
            render: (_, row) =>
              row.status === 'AGREED' && (
                <Space>
                  {row.kind === 'REFUND' && (
                    <Button
                      size="small"
                      onClick={() => {
                        confirmationForm.resetFields()
                        confirmationForm.setFieldsValue({ date: dayjs() })
                        setConfirmation(row)
                      }}
                    >
                      Подтвердить перевод
                    </Button>
                  )}
                  {(row.kind === 'REFUND' || canCancelCredit(row)) && (
                    <Popconfirm title="Отменить это решение?" onConfirm={() => performCancel(row)}>
                      <Button size="small" loading={cancelState.isLoading}>
                        Отменить
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
          },
        ]}
      />
      <Modal
        title={selection?.mode === 'REFUND' ? 'Возврат переплаты' : 'Согласованный зачёт процентов'}
        open={!!selection}
        forceRender
        onCancel={() => {
          if (!busy) setSelection(null)
        }}
        width={720}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
        footer={
          <Space wrap>
            <Button disabled={busy} onClick={() => setSelection(null)}>
              Закрыть
            </Button>
            {selection?.mode === 'CREDIT' && (
              <Button loading={previewState.isLoading} onClick={propose} disabled={agreeState.isLoading}>
                Предложить разбивку
              </Button>
            )}
            <Button
              type="primary"
              loading={refundState.isLoading || agreeState.isLoading}
              disabled={
                previewState.isLoading || (selection?.mode === 'CREDIT' && (!proposal?.targets.length || !accepted))
              }
              onClick={() => form.submit()}
            >
              {selection?.mode === 'REFUND' ? 'Запросить возврат' : 'Зафиксировать согласование'}
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph>
          {selection && sourceLabel(selection.credit.receiptId)}. Свободно:{' '}
          {money(selection?.credit.availableAmount ?? '0')}.
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          disabled={busy}
          onFinish={submit}
          onValuesChange={(changed) => {
            if ('amount' in changed || 'date' in changed) {
              setProposal(null)
              setAccepted(false)
            }
          }}
        >
          <Form.Item name="amount" label="Сумма, ₽" rules={[{ required: true }]}>
            <InputNumber<string> stringMode precision={2} min="0.01" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="date"
            label={selection?.mode === 'REFUND' ? 'Дата запроса возврата' : 'Дата согласования'}
            rules={[{ required: true }]}
          >
            <DatePicker format="DD.MM.YYYY" disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
          </Form.Item>
          {selection?.mode === 'REFUND' ? (
            <Form.Item name="comment" label="Примечание">
              <Input.TextArea maxLength={1000} />
            </Form.Item>
          ) : (
            <Form.Item
              name="agreementReference"
              label="Как согласовано с заёмщиком"
              rules={[{ required: true, whitespace: true, message: 'Укажите основание согласования' }]}
            >
              <Input.TextArea
                placeholder="Например: согласовано по телефону 6 ноября, подтверждено в переписке"
                maxLength={1000}
              />
            </Form.Item>
          )}
        </Form>
        {selection?.mode === 'REFUND' && (
          <Alert
            type="info"
            title="Создание запроса только резервирует деньги. После перевода в банке отдельно подтвердите его исполнение."
          />
        )}
        {proposal && selection?.mode === 'CREDIT' && (
          <>
            <Table
              rowKey="obligationKey"
              size="small"
              pagination={false}
              dataSource={proposal.targets}
              columns={[
                { title: 'Срок будущего платежа', dataIndex: 'obligationKey', render: (v) => date(String(v).slice(9)) },
                { title: 'Направить, ₽', dataIndex: 'amount', render: money },
              ]}
            />
            <Typography.Paragraph>
              Будет зачтено: {money(proposal.amountToAllocate)}. Из выбранной суммы останется к возврату:{' '}
              {money(proposal.remainingForRefund)}.
            </Typography.Paragraph>
            <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={busy}>
              Эта разбивка согласована с заёмщиком
            </Checkbox>
          </>
        )}
      </Modal>
      <Modal
        title="Подтверждение фактического возврата"
        open={!!confirmation}
        forceRender
        onCancel={() => {
          if (!confirmState.isLoading) setConfirmation(null)
        }}
        confirmLoading={confirmState.isLoading}
        okText="Возврат выполнен"
        onOk={() => confirmationForm.submit()}
      >
        <Alert type="info" title="Сначала выполните перевод в банке. Здесь фиксируется уже состоявшийся возврат." />
        <Form
          form={confirmationForm}
          layout="vertical"
          disabled={confirmState.isLoading}
          onFinish={async (v) => {
            try {
              await confirmRefund({
                dealId: deal.id,
                instructionId: confirmation!.id,
                date: v.date.format('YYYY-MM-DD'),
                transferReference: v.transferReference.trim(),
              }).unwrap()
              setConfirmation(null)
              notify.success('Фактический возврат подтверждён')
            } catch (e) {
              notify.error(getApiErrorMessage(e, 'Не удалось подтвердить возврат'))
            }
          }}
        >
          <Form.Item name="date" label="Дата перевода" rules={[{ required: true }]}>
            <DatePicker
              format="DD.MM.YYYY"
              disabledDate={(d) =>
                d.isAfter(dayjs(), 'day') || (!!confirmation && d.isBefore(dayjs(confirmation.effectiveOn), 'day'))
              }
            />
          </Form.Item>
          <Form.Item
            name="transferReference"
            label="Номер платежа или ссылка на подтверждение"
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
