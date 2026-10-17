import { Empty } from 'antd'

interface EmptySectionProps {
  description: string
}

export function EmptySection({ description }: EmptySectionProps) {
  return (
    <div className="app-empty-card">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
    </div>
  )
}
