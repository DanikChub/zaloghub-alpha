import { AppShell } from '../../../widgets/app-shell/ui/AppShell'
import { EmptySection } from '../../../shared/ui/empty-section/EmptySection'

export function DashboardPage() {
  return (
    <AppShell title="Главная" description="Обзор вашего рабочего пространства">
      <EmptySection description="Здесь появится сводка по сделкам и платежам" />
    </AppShell>
  )
}
