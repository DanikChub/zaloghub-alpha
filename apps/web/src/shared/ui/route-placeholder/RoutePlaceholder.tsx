import { Result } from 'antd'

interface RoutePlaceholderProps {
  title: string
}

export function RoutePlaceholder({ title }: RoutePlaceholderProps) {
  return <Result status="info" title={title} subTitle="Раздел в разработке" />
}
