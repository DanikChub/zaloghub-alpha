import { Tag, Typography } from 'antd'
import type { CheckItem, CheckRun } from './types'
import { statusLabels, riskLabels, resultText } from './display'
export function StatusTag({ value }: { value: string }) {
  return (
    <Tag
      color={
        ['COMPLETED', 'SUCCEEDED'].includes(value)
          ? 'green'
          : ['RUNNING', 'QUEUED', 'IN_PROGRESS'].includes(value)
            ? 'blue'
            : ['FAILED', 'ERROR', 'STALE'].includes(value)
              ? 'orange'
              : 'default'
      }
    >
      {statusLabels[value] ?? value}
    </Tag>
  )
}
export function RiskTag({ value }: { value: string }) {
  return (
    <Tag
      color={
        value === 'IDENTIFIED'
          ? 'red'
          : value === 'NEEDS_REVIEW'
            ? 'orange'
            : value === 'NOT_IDENTIFIED'
              ? 'green'
              : 'default'
      }
    >
      {riskLabels[value] ?? value}
    </Tag>
  )
}
export function ResultValue({
  item,
  run,
}: {
  item: CheckItem
  run?: CheckRun | null
}) {
  return (
    <Typography.Text
      type={!run || item.status === 'STALE' ? 'secondary' : undefined}
    >
      {item.status === 'STALE' ? 'Предыдущий результат: ' : ''}
      {resultText(item, run)}
    </Typography.Text>
  )
}
