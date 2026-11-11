import {
  cleanInlineText,
  detectObjectType,
  parseLoanTermMonths,
  parseMoney,
} from '../parser.utils.js';
import { createRegexDealParser } from '../createRegexDealParser.js';

function mapBorrowerTypeFromYesNo(value?: string | null) {
  if (!value) return null;

  const normalized = value.toLowerCase().trim();

  if (normalized.includes('нет')) return 'individual';
  if (normalized.includes('да')) return 'company';

  return null;
}

export const mosinvestfinanceParser = createRegexDealParser({
  key: 'mosinvestfinance',
  minConfidence: 0.4,

  fields: {
    objectName: {
      patterns: [/(?:🏡|🏠|🏢)\s*(.+)/],
      weight: 0.15,
    },

    address: {
      patterns: [
        /📍\s*Адрес:\s*([\s\S]+?)(?=\n\s*(?:⚖️|⚖|💰|💸|💵|💼|⏱|⏰|🎯|Дополнительная информация:|$))/i,
      ],
      transform: cleanInlineText,
      weight: 0.18,
    },

    loanAmount: {
      patterns: [/Сумма займа:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*[₽Р]/i],
      transform: parseMoney,
      weight: 0.35,
    },

    collateralValue: {
      patterns: [/Рыночная стоимость:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*[₽Р]/i],
      transform: parseMoney,
      weight: 0.12,
    },

    loanTermMonths: {
      patterns: [/Срок займа:\s*([^\n]+)/i],
      transform: parseLoanTermMonths,
      weight: 0.05,
    },

    borrowerType: {
      patterns: [/Юр\.?\s*Лицо:\s*([^\n]+)/i],
      transform: mapBorrowerTypeFromYesNo,
      weight: 0.03,
    },
  },

  derive(parsed, text) {
    if (parsed.objectName) {
      parsed.type = detectObjectType(parsed.objectName);
    }

    const lotMatch = text.match(/Лот\s*№\s*(\d+)/i);

    if (lotMatch?.[1]) {
      parsed.contactUrl = `https://t.me/mosinvestfinans_bot?start=${lotMatch[1]}`;
    }

    return parsed;
  },
});
