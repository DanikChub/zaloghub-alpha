import { Card, Empty } from 'antd'

interface EmptySectionProps {
  description: string
}

export function EmptySection({ description }: EmptySectionProps) {
  return (
    <Card className="app-empty-card">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
    </Card>
  )
}
