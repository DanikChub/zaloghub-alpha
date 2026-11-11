import { createRegexDealParser } from '../createRegexDealParser.js';
import {
  cleanInlineText,
  detectObjectType,
  getTelegramContactUrlFromPost,
  mapBorrowerType,
  parseInterestRateMonthly,
  parseLoanTermMonths,
  parseMoney,
} from '../parser.utils.js';

export const zalogDoveriyaParser = createRegexDealParser({
  key: 'zalog-doveriya',
  minConfidence: 0.45,

  fields: {
    objectName: {
      patterns: [/🏢\s*(.+)/],
      transform: cleanInlineText,
      weight: 0.15,
    },

    address: {
      patterns: [
        /📍\s*Адрес:\s*([\s\S]+?)(?=\n\s*📐|\n\s*💰|\n\s*📝|\n\s*💬|\n\s*📞|$)/i,
      ],
      transform: cleanInlineText,
      weight: 0.15,
    },

    objectParams: {
      patterns: [/📐\s*Параметры объекта:\s*([\s\S]+?)\n\n💰/i],
      transform: (value) => value.trim(),
      weight: 0.05,
    },

    loanAmount: {
      patterns: [/Сумма займа:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*₽/i],
      transform: parseMoney,
      weight: 0.35,
    },

    collateralValue: {
      patterns: [/Рыночная стоимость:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*₽/i],
      transform: parseMoney,
      weight: 0.1,
    },

    borrowerType: {
      patterns: [/Статус заемщика:\s*(.+)/i],
      transform: mapBorrowerType,
      weight: 0.02,
    },

    loanTermMonths: {
      patterns: [/Срок:\s*(.+)/i],
      transform: parseLoanTermMonths,
      weight: 0.04,
    },

    interestRateMonthly: {
      patterns: [/Ставка:\s*(.+)/i],
      transform: parseInterestRateMonthly,
      weight: 0.04,
    },
  },

  derive(parsed, text) {
    if (parsed.objectName && !parsed.type) {
      parsed.type = detectObjectType(parsed.objectName);
    }

    if (parsed.interestRateMonthly !== null) {
      parsed.interestRateMonthlySource = 'parsed';
    }

    const contactUrl = getTelegramContactUrlFromPost(text);
    if (contactUrl) {
      parsed.contactUrl = contactUrl;
    }

    return parsed;
  },
});
