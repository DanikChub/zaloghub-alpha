import type { CheckItem, CheckRun } from './types'
export const statusLabels: Record<string, string> = {
  DRAFT: 'Черновик',
  IN_PROGRESS: 'В работе',
  AWAITING_DOCUMENTS: 'Нужны документы',
  READY_FOR_REVIEW: 'На согласовании',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
  NOT_STARTED: 'Не проверено',
  MISSING_DATA: 'Не хватает данных',
  QUEUED: 'В очереди',
  RUNNING: 'Выполняется',
  ERROR: 'Ошибка',
  UNAVAILABLE: 'Недоступно',
  NOT_APPLICABLE: 'Не применимо',
  STALE: 'Нужна повторная проверка',
  AWAITING_REVIEW: 'Ожидает проверки',
  SUCCEEDED: 'Результат получен',
  FAILED: 'Ошибка',
}
export const riskLabels: Record<string, string> = {
  NOT_ASSESSED: 'Не оценён',
  NOT_IDENTIFIED: 'Не выявлен',
  NEEDS_REVIEW: 'Требует уточнения',
  IDENTIFIED: 'Выявлен риск',
}
export const decisionLabels: Record<string, string> = {
  PENDING: 'Не принято',
  APPROVED: 'Согласован',
  APPROVED_WITH_CONDITIONS: 'Согласован с условиями',
  REJECTED: 'Отказ',
}
export const categoryLabels: Record<string, string> = {
  CLEAR: 'По справке сведения отсутствуют',
  RECORDS_PRESENT: 'Есть сведения о судимости',
  INVESTIGATION: 'Есть сведения об уголовном преследовании',
  REQUIRES_REVIEW: 'Требует дополнительной оценки',
  NO_RESTRICTIONS_IN_DOCUMENT: 'В документе нет сведений об ограничении',
  RESTRICTED: 'Ограниченно дееспособен',
  INCAPACITATED: 'Признан недееспособным',
  ACTIVE: 'ИП действует',
  TERMINATED: 'ИП прекращён',
  NOT_REGISTERED: 'Не зарегистрирован как ИП',
}
export const fieldLabels: Record<string, string> = {
  identity: 'Подтверждённые данные',
  firstName: 'Имя',
  lastName: 'Фамилия',
  birthDate: 'Дата рождения',
  passportSeries: 'Серия паспорта',
  passportNumber: 'Номер паспорта',
  passportIssuedOn: 'Дата выдачи паспорта',
  inn: 'ИНН',
  definition: 'Определение проверки',
}
export const evidenceKinds: Record<string, string> = {
  PASSPORT: 'Паспорт',
  SNILS: 'СНИЛС',
  CERTIFICATE: 'Справка',
  EXTRACT: 'Выписка',
  SCREENSHOT: 'Скриншот',
  PROVIDER_RESPONSE: 'Ответ источника',
  OTHER: 'Другой документ',
}
export const authenticityLabels: Record<string, string> = {
  NOT_CHECKED: 'Не проверен',
  CONFIRMED: 'Подтверждён',
  DOUBTFUL: 'Есть сомнения',
  REJECTED: 'Отклонён',
}
export const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(
        new Date(value),
      )
    : '—'
export const formatTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—'
export const money = (value: string | null | undefined, currency = 'RUB') =>
  value != null
    ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(
        Number(value),
      )
    : '—'
export function resultText(item: CheckItem, run?: CheckRun | null) {
  if (item.status === 'NOT_APPLICABLE') return 'Не применимо'
  if (!run) return 'Результата пока нет'
  if (run.status === 'CANCELLED') return 'Запуск отменён'
  if (run.status === 'FAILED')
    return run.errorMessage ?? 'Не удалось выполнить проверку'
  if (['QUEUED', 'RUNNING'].includes(run.status))
    return statusLabels[run.status]
  if (item.resultType === 'BOOLEAN')
    return run.resultBoolean === null
      ? 'Не установлено'
      : run.resultBoolean
        ? 'Да'
        : 'Нет'
  if (item.resultType === 'CATEGORY')
    return (
      categoryLabels[run.resultCode ?? ''] ?? run.resultCode ?? 'Не установлено'
    )
  if (item.resultType === 'MONEY')
    return money(run.resultAmount, run.currency ?? 'RUB')
  if (item.resultType === 'DOCUMENT') return 'Документ приложен'
  return run.findings?.length
    ? `Найдено записей: ${run.findings.length}`
    : 'Совпадений не найдено в пределах проверки'
}
