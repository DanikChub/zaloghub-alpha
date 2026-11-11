import { Decimal } from 'decimal.js';
import { parserRegistry } from './parsers/parser.registry.js';
import {
  parseInterestRateMonthly,
  getTelegramContactUrlFromPost,
} from './parsers/parser.utils.js';

export const PARSER_VERSION = 'alpha-marketplace-1';
const cities = [
  'Москва',
  'Санкт-Петербург',
  'Новосибирск',
  'Екатеринбург',
  'Казань',
  'Нижний Новгород',
  'Красноярск',
  'Челябинск',
  'Самара',
  'Уфа',
  'Ростов-на-Дону',
  'Омск',
  'Краснодар',
  'Воронеж',
  'Пермь',
  'Волгоград',
];
export function parseOffer(
  key: string,
  text: string,
  fallbackContact: string | null,
) {
  const parser = parserRegistry.get(key);
  let result: ReturnType<NonNullable<typeof parser>['parse']> | undefined;
  let parseError: string | null = null;
  try {
    result = parser?.parse({
      text,
      sourceType: 'telegram',
      sourceId: 0,
      sourceChannelId: null,
      sourceTitle: null,
      externalMessageId: '',
    });
    if (!parser) parseError = 'Неизвестный обработчик источника';
  } catch {
    parseError = 'Ошибка обработчика; исходное сообщение сохранено';
  }
  const fields = result?.parsed;
  const rateText = text.match(/Ставка:[ \t]*([^\n]+)/i)?.[1] ?? null;
  // Re-read explicit units: legacy channel parsers may omit rates entirely.
  const rate = parseInterestRateMonthly(rateText);
  const amount = fields?.loanAmount ?? null;
  const value = fields?.collateralValue ?? null;
  const term = fields?.loanTermMonths ?? null;
  const issues: string[] = [];
  const bounded = (value: Decimal, places: number, integerDigits: number) => {
    const rounded = value.toDecimalPlaces(places);
    if (
      !rounded.isFinite() ||
      rounded.abs().gte(new Decimal(10).pow(integerDigits))
    ) {
      issues.push(
        'Расчёт выходит за поддерживаемый диапазон; сверьте исходный текст',
      );
      return null;
    }
    return rounded.toNumber();
  };
  const ltv =
    amount !== null && value !== null && value > 0
      ? bounded(new Decimal(amount).div(value).mul(100), 8, 10)
      : null;
  const income =
    amount !== null && rate !== null
      ? bounded(new Decimal(amount).mul(rate).div(100), 2, 18)
      : null;
  const total =
    income !== null && term !== null
      ? bounded(new Decimal(income).mul(term), 2, 18)
      : null;
  const address = fields?.address ?? null;
  const explicitCity = address?.match(
    /(?:^|[,;]\s*)(?:г\.?|город)\s+([А-ЯЁ][а-яё-]+(?:[ -][А-ЯЁ][а-яё]+)?)/,
  )?.[1];
  const knownCities = cities.filter((city) =>
    address?.toLowerCase().includes(city.toLowerCase()),
  );
  const city =
    explicitCity ?? (knownCities.length === 1 ? knownCities[0] : null);
  const contact =
    fields?.contactUrl ??
    getTelegramContactUrlFromPost(text) ??
    fallbackContact;
  return {
    parserVersion: PARSER_VERSION,
    parseStatus: parseError
      ? 'ERROR'
      : result?.shouldSave && !issues.length
        ? 'PARSED'
        : 'PARTIAL',
    parseError:
      parseError ??
      (issues.length
        ? issues.join('; ')
        : result?.shouldSave
          ? null
          : (result?.reason ?? 'Недостаточно данных')),
    objectName: fields?.objectName ?? null,
    objectType: fields?.type ?? null,
    address,
    city,
    borrowerType: fields?.borrowerType ?? null,
    contactUrl: contact,
    loanAmount: amount,
    collateralValue: value,
    interestRateMonthly: rate,
    loanTermMonths: term,
    ltv,
    monthlyIncome: income,
    totalIncome: total,
    declared: {
      loanAmount: amount,
      collateralValue: value,
      rateText,
      address,
      objectName: fields?.objectName ?? null,
      loanTermMonths: term,
      objectParams: fields?.objectParams ?? null,
      borrowerType: fields?.borrowerType ?? null,
      contactUrl: fields?.contactUrl ?? getTelegramContactUrlFromPost(text),
    },
    calculated: {
      ltv,
      interestRateMonthly: rate,
      monthlyIncome: income,
      totalIncome: total,
      rateBasis:
        rate === null
          ? null
          : /год/i.test(rateText ?? '')
            ? 'annual/12'
            : 'monthly',
      incomeModel: 'Простой процент, без комиссий и погашения основного долга',
    },
    inferred: {
      city,
      cityBasis: city ? 'По адресу из объявления, без геокодирования' : null,
      objectType: fields?.type ?? null,
      contactFallback:
        !fields?.contactUrl && !getTelegramContactUrlFromPost(text)
          ? fallbackContact
          : null,
    },
  };
}
