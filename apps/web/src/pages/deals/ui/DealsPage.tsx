import { AppShell } from '../../../widgets/app-shell/ui/AppShell'
import { EmptySection } from '../../../shared/ui/empty-section/EmptySection'

export function DealsPage() {
  return (
    <AppShell title="Сделки" description="Все залоговые сделки в одном месте">
      <EmptySection description="Список сделок пока пуст" />
    </AppShell>
  )
}
