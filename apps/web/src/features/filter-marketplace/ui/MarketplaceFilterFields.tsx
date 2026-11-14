import { Button, Input, InputNumber, Select, Space, Typography } from "antd";
import type { MarketplaceDictionaries } from "../../../entities/marketplace-offer";
import type {
  MarketplaceFilters,
  ChangeMarketplaceFilter,
} from "../model/types";
import "./marketplace-filter-fields.css";
interface MarketplaceFilterFieldsProps {
  filters: MarketplaceFilters;
  dictionaries?: MarketplaceDictionaries;
  onChange: ChangeMarketplaceFilter;
  onReset: () => void;
}
export function MarketplaceFilterFields({
  filters,
  dictionaries,
  onChange: change,
  onReset,
}: MarketplaceFilterFieldsProps) {
  const select = (
    key: string,
    placeholder: string,
    values: { label: string; value: string }[],
  ) => (
    <Select
      aria-label={placeholder}
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder={placeholder}
      value={filters[key]}
      options={values}
      onChange={(v) => change(key, v)}
    />
  );
  return (
    <>
      <div className="market-filter-grid">
        <Input.Search
          aria-label="Поиск предложений"
          placeholder="Адрес, объект или текст"
          defaultValue={filters.search}
          onSearch={(v) => change("search", v)}
          allowClear
        />
        {select(
          "city",
          "Город",
          (dictionaries?.cities ?? []).map((v) => ({
            value: v,
            label: v,
          })),
        )}
        {select(
          "objectType",
          "Тип объекта",
          (dictionaries?.objectTypes ?? []).map((v) => ({
            value: v,
            label: v,
          })),
        )}
        {select(
          "sourceId",
          "Источник",
          (dictionaries?.sources ?? []).map((v) => ({
            value: v.id,
            label: v.title,
          })),
        )}
        {select("view", "Все предложения", [
          { value: "all", label: "Все предложения" },
          { value: "saved", label: "Сохранённые" },
          { value: "hidden", label: "Скрытые" },
        ])}
        {select("borrowerType", "Тип заёмщика", [
          { value: "individual", label: "Физическое лицо" },
          { value: "self_employed", label: "Самозанятый" },
          { value: "sole_proprietor", label: "ИП" },
          { value: "company", label: "Компания" },
        ])}
        {select("sort", "Сортировка", [
          { value: "publishedAt", label: "Дата публикации" },
          { value: "loanAmount", label: "Сумма займа" },
          { value: "collateralValue", label: "Стоимость залога" },
          { value: "interestRateMonthly", label: "Ставка" },
          { value: "loanTermMonths", label: "Срок" },
          { value: "ltv", label: "LTV" },
        ])}
        {select("order", "По убыванию", [
          { value: "desc", label: "По убыванию" },
          { value: "asc", label: "По возрастанию" },
        ])}
      </div>
      <div className="market-filter-grid market-ranges">
        {(["Amount", "Value", "Rate", "Term", "Ltv"] as const).map((key, i) => (
          <div key={key}>
            <Typography.Text>
              {
                [
                  "Сумма, ₽",
                  "Залог, ₽",
                  "Ставка, %/мес.",
                  "Срок, мес.",
                  "LTV, %",
                ][i]
              }
            </Typography.Text>
            <Space.Compact block>
              {["min", "max"].map((prefix, j) => (
                <InputNumber
                  key={prefix}
                  aria-label={`${["Сумма", "Залог", "Ставка", "Срок", "LTV"][i]} ${j === 0 ? "от" : "до"}`}
                  min={0}
                  placeholder={j === 0 ? "От" : "До"}
                  value={
                    filters[prefix + key] === undefined
                      ? null
                      : Number(filters[prefix + key])
                  }
                  onChange={(v) => change(prefix + key, v)}
                />
              ))}
            </Space.Compact>
          </div>
        ))}
        <Button onClick={onReset}>Сбросить фильтры</Button>
      </div>
    </>
  );
}
