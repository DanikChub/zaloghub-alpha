export type BorrowerType =
  'individual' | 'self_employed' | 'sole_proprietor' | 'company';

export function parseMoney(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[\s\u00a0]/g, '');
  const match = normalized.match(/^(\d+(?:[.,]\d+)*)((?:млн|тыс))?/);
  if (!match) return null;
  const digits = /^\d{1,3}(?:[.]\d{3})+$/.test(match[1])
    ? match[1].replaceAll('.', '')
    : match[1].replace(',', '.');
  const number =
    Number(digits) *
    (match[2] === 'млн' ? 1000000 : match[2] === 'тыс' ? 1000 : 1);
  return Number.isFinite(number) && number >= 0.01 && number <= 1e14
    ? number
    : null;
}

export function parseInterestRateMonthly(value?: string | null): number | null {
  if (!value || /(?:^|\s)(?:от|до)\s|[–—]|\d\s*-\s*\d/i.test(value))
    return null;
  const match = value.match(
    /(\d+(?:[.,]\d+)?)\s*%\s*(?:в\s*)?(мес(?:яц)?|\/мес|годовых|год|\/год)/i,
  );
  if (!match) return null;
  const rate = Number(match[1].replace(',', '.'));
  return Number.isFinite(rate) && rate >= 0 && rate <= 1000000
    ? /год/i.test(match[2])
      ? rate / 12
      : rate
    : null;
}

export function parseLoanTermMonths(value?: string | null): number | null {
  if (!value || /(?:^|\s)(?:от|до)\s|[–—]|\d\s*-\s*\d/i.test(value))
    return null;

  const normalized = value.toLowerCase().trim();

  if (normalized.includes('полгода')) return 6;

  const monthMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(?:мес|месяц|месяца|месяцев)/i,
  );
  if (monthMatch?.[1]) {
    const num = Number(monthMatch[1].replace(',', '.'));
    return Number.isFinite(num) && num > 0 && num <= 1200 ? num : null;
  }

  const yearMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:год|года|лет)/i);
  if (yearMatch?.[1]) {
    const years = Number(yearMatch[1].replace(',', '.'));
    return Number.isFinite(years) && years > 0 && years <= 100
      ? years * 12
      : null;
  }

  return null;
}

export function mapBorrowerType(value?: string | null): BorrowerType | null {
  if (!value) return null;

  const normalized = value.toLowerCase().trim();

  if (
    normalized.includes('смз') ||
    normalized.includes('сз') ||
    normalized.includes('самозан')
  ) {
    return 'self_employed';
  }

  if (
    normalized === 'ип' ||
    normalized.includes(' ип') ||
    normalized.includes('ип ') ||
    normalized.includes('индивидуальный предприниматель')
  ) {
    return 'sole_proprietor';
  }

  if (
    normalized.includes('юр') ||
    normalized.includes('ооо') ||
    normalized.includes('зао') ||
    normalized.includes('ао') ||
    normalized.includes('компан')
  ) {
    return 'company';
  }

  if (
    normalized.includes('физ') ||
    normalized.includes('частн') ||
    normalized.includes('нет')
  ) {
    return 'individual';
  }

  return null;
}

export function cleanInlineText(value: string): string {
  return value.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

export function detectObjectType(value?: string | null): string | null {
  if (!value) return null;

  const lower = value.toLowerCase();

  if (lower.includes('квартира')) return 'квартира';
  if (lower.includes('апартамент')) return 'апартаменты';
  if (lower.includes('дом')) return 'дом';
  if (lower.includes('участ')) return 'участок';
  if (lower.includes('коммер')) return 'коммерческая недвижимость';
  if (lower.includes('машиноместо')) return 'машиноместо';
  if (lower.includes('гараж')) return 'гараж';

  return value.split(/\s+/)[0] || null;
}

export function getTelegramContactUrlFromPost(text: string): string | null {
  if (!text) return null;

  // 1. Ищем блок с контактом (расширенный список триггеров)
  const contactBlockMatch = text.match(
    /(?:свяжитесь|контакты|для уточнения деталей|обращаться|писать|узнать|подробно|👨🏻‍💻|📞|👉)[\s\S]{0,250}/i,
  );

  const searchText = contactBlockMatch ? contactBlockMatch[0] : text;

  // 2. Ищем username (но избегаем хэштегов)
  const match = searchText.match(/(?:^|\s)@([a-zA-Z0-9_]{4,32})/);

  if (match?.[1]) {
    return `https://t.me/${match[1]}`;
  }

  // 3. Fallback: ищем в конце поста (часто там контакт)
  const tail = text.slice(-300);

  const fallbackMatch = tail.match(/(?:^|\s)@([a-zA-Z0-9_]{4,32})/);

  if (fallbackMatch?.[1]) {
    return `https://t.me/${fallbackMatch[1]}`;
  }

  return null;
}
