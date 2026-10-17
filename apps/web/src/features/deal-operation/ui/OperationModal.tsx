import { DatePicker, Form, Input, InputNumber, Modal, Select, message } from 'antd'
import dayjs from 'dayjs'
import { useAddDisbursementMutation, useAddPaymentMutation } from '../../../entities/deal/api/dealsApi'
import type { PaymentType } from '../../../entities/deal/model/types'
import { paymentTypes } from '../../../entities/deal/lib/format'
import { getApiErrorMessage } from '../../../shared/lib/api-error'

interface Props { dealId: string; kind: 'payment' | 'disbursement'; open: boolean; onClose: () => void }
interface Values { amount: number; date: dayjs.Dayjs; type: PaymentType; comment?: string }

export function OperationModal({ dealId, kind, open, onClose }: Props) {
  const [form] = Form.useForm<Values>()
  const [addPayment, paymentState] = useAddPaymentMutation()
  const [addDisbursement, disbursementState] = useAddDisbursementMutation()
  const [notify, holder] = message.useMessage()
  const save = async (values: Values) => {
    const body = { dealId, amount: values.amount, date: values.date.format('YYYY-MM-DD'), comment: values.comment }
    try {
      if (kind === 'payment') await addPayment({ ...body, type: values.type }).unwrap()
      else await addDisbursement(body).unwrap()
      notify.success('Операция добавлена')
      form.resetFields()
      onClose()
    } catch (error) { notify.error(getApiErrorMessage(error)) }
  }
  return <>
    {holder}
    <Modal title={kind === 'payment' ? 'Новое поступление' : 'Выдача средств'} open={open} onCancel={onClose} onOk={() => form.submit()} okText="Добавить" confirmLoading={paymentState.isLoading || disbursementState.isLoading} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save} initialValues={{ date: dayjs(), type: 'INTEREST' }}>
        <Form.Item name="amount" label="Сумма, ₽" rules={[{ required: true }]}><InputNumber min={0.01} precision={2} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="date" label="Дата операции" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
        {kind === 'payment' && <Form.Item name="type" label="Назначение" rules={[{ required: true }]}><Select options={(Object.keys(paymentTypes) as PaymentType[]).map((value) => ({ value, label: paymentTypes[value] }))} /></Form.Item>}
        <Form.Item name="comment" label="Примечание"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  </>
}
