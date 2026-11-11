import { useRef } from 'react'
import { DatePicker, Form, Input, InputNumber, Modal, message } from 'antd'
import dayjs from 'dayjs'
import { useAddDisbursementMutation, useAddPaymentMutation } from '../../../entities/deal/api/dealsApi'
import { getApiErrorMessage } from '../../../shared/lib/api-error'

interface Props {
  dealId: string
  kind: 'payment' | 'disbursement'
  open: boolean
  onClose: () => void
}
interface Values {
  amount: string
  date: dayjs.Dayjs
  comment?: string
}

export function OperationModal({ dealId, kind, open, onClose }: Props) {
  const [form] = Form.useForm<Values>()
  const [addPayment, paymentState] = useAddPaymentMutation()
  const [addDisbursement, disbursementState] = useAddDisbursementMutation()
  const [notify, holder] = message.useMessage()
  const request = useRef<{ fingerprint: string; key: string } | null>(null)
  const save = async (values: Values) => {
    const body = { dealId, amount: values.amount, date: values.date.format('YYYY-MM-DD'), comment: values.comment }
    const fingerprint = JSON.stringify(body)
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() }
    const data = { ...body, idempotencyKey: request.current.key }
    try {
      if (kind === 'payment') await addPayment(data).unwrap()
      else await addDisbursement(data).unwrap()
      notify.success('Операция добавлена')
      form.resetFields()
      request.current = null
      onClose()
    } catch (error) {
      notify.error(getApiErrorMessage(error, 'Не удалось сохранить операцию'))
    }
  }
  return (
    <>
      {holder}
      <Modal
        title={kind === 'payment' ? 'Новое поступление' : 'Выдача средств'}
        open={open}
        onCancel={onClose}
        onOk={() => form.submit()}
        okText="Добавить"
        confirmLoading={paymentState.isLoading || disbursementState.isLoading}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ date: dayjs() }}>
          <Form.Item name="amount" label="Сумма, ₽" rules={[{ required: true }]}>
            <InputNumber<string> stringMode min="0.01" precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="date" label="Дата операции" rules={[{ required: true }]}>
            <DatePicker
              disabledDate={(value) => value.isAfter(dayjs(), 'day')}
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
            />
          </Form.Item>
          <Form.Item name="comment" label="Примечание">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
