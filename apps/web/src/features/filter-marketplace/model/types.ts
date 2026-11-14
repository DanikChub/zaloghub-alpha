export type MarketplaceFilters = Record<string, string>;
export type FilterValue = string | number | null | undefined;
export type ChangeMarketplaceFilter = (key: string, value: FilterValue) => void;
