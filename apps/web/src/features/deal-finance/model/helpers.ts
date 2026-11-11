import { useRef } from 'react'
import dayjs from 'dayjs'

/** Только перевод единиц ввода ставки, без расчёта денежных обязательств. */
export function shiftDecimal(value: string, places: number): string {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('Введите ставку числом через точку')
  const [whole, fraction = ''] = value.split('.')
  const digits = whole + fraction
  const point = whole.length + places
  const text =
    point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + '0'.repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`
  return text
    .replace(/^0+(?=\d)/, '')
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}
export const today = () => dayjs().format('YYYY-MM-DD')
export function useRequestKey() {
  const current = useRef<{ fingerprint: string; key: string } | null>(null)
  return {
    key: (body: unknown) => {
      const fingerprint = JSON.stringify(body)
      if (current.current?.fingerprint !== fingerprint) current.current = { fingerprint, key: crypto.randomUUID() }
      return current.current.key
    },
    reset: () => {
      current.current = null
    },
  }
}
