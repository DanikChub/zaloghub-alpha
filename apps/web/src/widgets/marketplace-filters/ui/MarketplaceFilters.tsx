import { Alert, Button, Card } from "antd";
import { useDictionariesQuery } from "../../../entities/marketplace-offer";
import {
  MarketplaceFilterFields,
  type MarketplaceFilters as FilterValues,
  type ChangeMarketplaceFilter,
} from "../../../features/filter-marketplace";
import "./marketplace-filters.css";
interface MarketplaceFiltersProps {
  filters: FilterValues;
  onChange: ChangeMarketplaceFilter;
  onReset: () => void;
}
export function MarketplaceFilters({
  filters,
  onChange,
  onReset,
}: MarketplaceFiltersProps) {
  const dictionaries = useDictionariesQuery();
  return (
    <>
      <Card className="market-filters">
        <MarketplaceFilterFields
          filters={filters}
          dictionaries={dictionaries.data}
          onChange={onChange}
          onReset={onReset}
        />
      </Card>
      {dictionaries.isError && (
        <Alert
          type="warning"
          title="Не удалось загрузить справочники"
          action={
            <Button onClick={() => void dictionaries.refetch()}>
              Повторить
            </Button>
          }
        />
      )}
    </>
  );
}
