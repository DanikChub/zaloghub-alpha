import { useSearchParams } from "react-router";
import type { FilterValue } from "./types";
export function useMarketplaceFilters() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(params);
  const change = (key: string, value: FilterValue) => {
    const next = new URLSearchParams(params);
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  const reset = () => setParams({});
  return { filters, change, reset };
}
