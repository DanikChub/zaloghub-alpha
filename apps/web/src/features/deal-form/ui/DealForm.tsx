import { useEffect } from 'react'
import { Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space, message } from 'antd'
import dayjs from 'dayjs'
import { useCreateBorrowerMutation, useCreateCollateralMutation, useCreateDealMutation, useGetBorrowersQuery, useGetCollateralsQuery, useUpdateDealMutation } from '../../../entities/deal/api/dealsApi'
import type { Deal, DealInput } from '../../../entities/deal/model/types'
import { getApiErrorMessage } from '../../../shared/lib/api-error'

interface Props { open: boolean; onClose: () => void; onSaved: (id: string) => void; deal?: Deal }
type FormValues = Omit<DealInput, 'signedAt'> & { signedAt?: dayjs.Dayjs }

export function DealForm({ open, onClose, onSaved, deal }: Props) {
  const [form] = Form.useForm<FormValues>()
  const { data: borrowers = [] } = useGetBorrowersQuery()
  const { data: collaterals = [] } = useGetCollateralsQuery()
  const [createDeal, createState] = useCreateDealMutation()
  const [updateDeal, updateState] = useUpdateDealMutation()
  const [createBorrower] = useCreateBorrowerMutation()
  const [createCollateral] = useCreateCollateralMutation()
  const [borrowerOpen, borrowerModalHolder] = Modal.useModal()
  const [collateralOpen, collateralModalHolder] = Modal.useModal()
  const [notify, contextHolder] = message.useMessage()

  useEffect(() => {
    if (!open) return
    form.setFieldsValue(deal ? {
      contractNumber: deal.contractNumber ?? undefined,
      contractCity: deal.contractCity ?? undefined,
      signedAt: deal.signedAt ? dayjs(deal.signedAt) : undefined,
      borrowerId: deal.borrowerId ?? undefined,
      collateralId: deal.collateralId ?? undefined,
      principalAmount: Number(deal.principalAmount),
      preferentialRate: Number(deal.preferentialRate),
      standardRate: Number(deal.standardRate),
      moratoriumMonths: deal.moratoriumMonths,
      termMonths: deal.termMonths,
      penaltyRate: Number(deal.penaltyRate),
      increasedPenaltyRate: Number(deal.increasedPenaltyRate),
      paymentDay: deal.paymentDay,
      status: deal.status,
    } : {
      preferentialRate: 4, standardRate: 6, moratoriumMonths: 6, termMonths: 36,
      penaltyRate: 0.5, increasedPenaltyRate: 1, paymentDay: 25, status: 'DRAFT',
    })
  }, [open, deal, form])

  const save = async (values: FormValues) => {
    const body: DealInput = { ...values, signedAt: values.signedAt?.format('YYYY-MM-DD') }
    try {
      const result = deal ? await updateDeal({ id: deal.id, body }).unwrap() : await createDeal(body).unwrap()
      notify.success('Сделка сохранена')
      onSaved(result.id)
    } catch (error) { notify.error(getApiErrorMessage(error, 'Не удалось сохранить данные')) }
  }

  const addBorrower = () => {
    let firstName = '', lastName = ''
    borrowerOpen.confirm({
      title: 'Новый заёмщик',
      content: <Space direction="vertical" style={{ width: '100%' }}>
        <Input placeholder="Фамилия" onChange={(event) => { lastName = event.target.value }} />
        <Input placeholder="Имя" onChange={(event) => { firstName = event.target.value }} />
      </Space>,
      onOk: async () => {
        if (!firstName.trim() || !lastName.trim()) { notify.error('Укажите имя и фамилию'); return Promise.reject() }
        try { const borrower = await createBorrower({ firstName: firstName.trim(), lastName: lastName.trim() }).unwrap(); form.setFieldValue('borrowerId', borrower.id) }
        catch (error) { notify.error(getApiErrorMessage(error, 'Не удалось сохранить данные')); return Promise.reject() }
      },
    })
  }
  const addCollateral = () => {
    let address = '', type = 'APARTMENT'
    collateralOpen.confirm({
      title: 'Новый залог',
      content: <Space direction="vertical" style={{ width: '100%' }}>
        <Select style={{ width: '100%' }} defaultValue="APARTMENT" options={[{ value: 'APARTMENT', label: 'Квартира' }, { value: 'HOUSE', label: 'Дом' }, { value: 'LAND', label: 'Участок' }, { value: 'OTHER', label: 'Другое' }]} onChange={(value) => { type = value }} />
        <Input placeholder="Адрес объекта" onChange={(event) => { address = event.target.value }} />
      </Space>,
      onOk: async () => {
        if (!address.trim()) { notify.error('Укажите адрес'); return Promise.reject() }
        try { const collateral = await createCollateral({ type, address: address.trim() }).unwrap(); form.setFieldValue('collateralId', collateral.id) }
        catch (error) { notify.error(getApiErrorMessage(error, 'Не удалось сохранить данные')); return Promise.reject() }
      },
    })
  }

  return <>
    {contextHolder}
    {borrowerModalHolder}
    {collateralModalHolder}
    <Modal title={deal ? 'Редактирование сделки' : 'Новая сделка'} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={createState.isLoading || updateState.isLoading} okText="Сохранить" width={760} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save}>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="contractNumber" label="Номер договора"><Input placeholder="Например, 15" /></Form.Item></Col>
          <Col span={12}><Form.Item name="signedAt" label="Дата договора"><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item></Col>
          <Col span={12}><Form.Item name="contractCity" label="Город заключения"><Input placeholder="Воронеж" /></Form.Item></Col>
          <Col span={12}><Form.Item name="status" label="Статус" rules={[{ required: true }]}><Select options={[{ value: 'DRAFT', label: 'Черновик' }, { value: 'ACTIVE', label: 'Действует' }, { value: 'CLOSED', label: 'Закрыта' }]} /></Form.Item></Col>
          <Col span={12}><Form.Item label={<Space>Заёмщик <Button type="link" size="small" onClick={addBorrower}>+ Добавить</Button></Space>} name="borrowerId"><Select allowClear showSearch optionFilterProp="label" options={borrowers.map((item) => ({ value: item.id, label: `${item.lastName} ${item.firstName} ${item.middleName ?? ''}`.trim() }))} placeholder="Выберите заёмщика" /></Form.Item></Col>
          <Col span={12}><Form.Item label={<Space>Залог <Button type="link" size="small" onClick={addCollateral}>+ Добавить</Button></Space>} name="collateralId"><Select allowClear showSearch optionFilterProp="label" options={collaterals.map((item) => ({ value: item.id, label: item.address }))} placeholder="Выберите объект" /></Form.Item></Col>
          <Col span={12}><Form.Item name="principalAmount" label="Сумма займа, ₽" rules={[{ required: true, message: 'Укажите сумму' }]}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="preferentialRate" label="Льготная, %/мес" rules={[{ required: true }]}><InputNumber min={0} precision={4} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="standardRate" label="Основная, %/мес" rules={[{ required: true }]}><InputNumber min={0} precision={4} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="moratoriumMonths" label="Мораторий, мес." rules={[{ required: true }]}><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="termMonths" label="Срок займа, мес." rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="penaltyRate" label="Неустойка, %/день" rules={[{ required: true }]}><InputNumber min={0} precision={4} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="increasedPenaltyRate" label="Повышенная, %/день" rules={[{ required: true }]}><InputNumber min={0} precision={4} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="paymentDay" label="День платежа" rules={[{ required: true }]}><InputNumber min={1} max={31} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  </>
}
