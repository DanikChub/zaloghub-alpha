import { AppShell } from "../../../widgets/app-shell/ui/AppShell";
import { MarketplaceFilters } from "../../../widgets/marketplace-filters";
import { MarketplaceFeed } from "../../../widgets/marketplace-feed";
import { useMarketplaceFilters } from "../../../features/filter-marketplace";

export function MarketplacePage() {
  const { filters, change, reset } = useMarketplaceFilters();
  return (
    <AppShell
      title="Маркетплейс"
      description="Предложения из Telegram. Данные объявлений не являются результатом проверки заёмщика или залога."
    >
      <MarketplaceFilters filters={filters} onChange={change} onReset={reset} />
      <MarketplaceFeed filters={filters} />
    </AppShell>
  );
}
