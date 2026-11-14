export const formatOfferNumber = (value: string | null, suffix = "") =>
  value === null
    ? "Не указано"
    : `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}${suffix}`;
export const formatOfferDate = (value: string) =>
  new Date(value).toLocaleString("ru-RU");


type LtvStatus = {
    color: string;
    label: string;
    hint: string;
};

export const getOfferLtvStatus = (
    value: string | null,
): LtvStatus => {
    const ltv = value?.trim() ? Number(value) : NaN;

    if (!Number.isFinite(ltv) || ltv < 0) {
        return {
            color: "default",
            label: "LTV неизвестен",
            hint: "Недостаточно данных для расчёта.",
        };
    }

    const hint =
        "Отношение суммы займа к стоимости залога из объявления. " +
        "Стоимость требует проверки; цвет показывает только уровень LTV.";

    if (ltv < 20)
        return { color: "green", label: "Очень низкий LTV", hint };

    if (ltv < 40)
        return { color: "cyan", label: "Низкий LTV", hint };

    if (ltv < 60)
        return { color: "blue", label: "Умеренный LTV", hint };

    if (ltv < 80)
        return { color: "orange", label: "Повышенный LTV", hint };

    return { color: "red", label: "Высокий LTV", hint };
};
