import type { Deal } from '../model/types'

export const money = (value: number | string) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(Number(value))
export const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('ru-RU') : '—'
export const borrowerName = (deal: Deal) => deal.borrower ? [deal.borrower.lastName, deal.borrower.firstName, deal.borrower.middleName].filter(Boolean).join(' ') : 'Заёмщик не выбран'
export const issuedTotal = (deal: Deal) => deal.disbursements.reduce((sum, item) => sum + Number(item.amount), 0)
export const principalReturned = (deal: Deal) => deal.payments.filter((item) => item.type === 'PRINCIPAL').reduce((sum, item) => sum + Number(item.amount), 0)
export const dealStatuses = { DRAFT: 'Черновик', ACTIVE: 'Действует', CLOSED: 'Закрыта' } as const
export const paymentTypes = { INTEREST: 'Проценты', PRINCIPAL: 'Тело займа', PENALTY: 'Неустойка', OTHER: 'Прочее' } as const
