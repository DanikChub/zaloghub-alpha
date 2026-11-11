import {
  parseMoney,
  parseLoanTermMonths,
  parseInterestRateMonthly,
  mapBorrowerType,
  cleanInlineText,
  detectObjectType,
  getTelegramContactUrlFromPost,
} from '../parser.utils.js';

import { createRegexDealParser } from '../createRegexDealParser.js';

export const aktivKapitalParser = createRegexDealParser({
  key: 'aktiv-kapital',
  minConfidence: 0.4,

  fields: {
    // 🏠 Тип объекта
    type: {
      patterns: [/🏠\s*Тип объекта:\s*([^\n]+)/i],
      transform: (v) => detectObjectType(v),
      weight: 0.12,
    },

    objectName: {
      patterns: [/🏠\s*Тип объекта:\s*([^\n]+)/i],
      transform: cleanInlineText,
      weight: 0.1,
    },

    // 📍 Адрес
    address: {
      patterns: [/📍\s*Адрес:\s*([^\n]+)/i],
      transform: cleanInlineText,
      weight: 0.2,
    },

    // 💰 Сумма займа
    loanAmount: {
      patterns: [
        /Сумма запроса:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*₽/i,
        /Сумма займа:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*₽/i,
      ],
      transform: parseMoney,
      weight: 0.35,
    },

    // 📈 Рыночная стоимость
    collateralValue: {
      patterns: [/Рыночная стоимость:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*₽/i],
      transform: parseMoney,
      weight: 0.12,
    },

    // 📆 Срок
    loanTermMonths: {
      patterns: [/Срок:\s*([^\n]+)/i],
      transform: parseLoanTermMonths,
      weight: 0.05,
    },

    // 💵 Ставка
    interestRateMonthly: {
      patterns: [/Ставка:\s*([^\n]+)/i],
      transform: parseInterestRateMonthly,
      weight: 0.05,
    },

    // 🧰 Статус
    borrowerType: {
      patterns: [/Статус:\s*([^\n]+)/i],
      transform: mapBorrowerType,
      weight: 0.03,
    },
  },

  derive(parsed, text) {
    // Если тип не нашли — пытаемся из objectName
    if (!parsed.type && parsed.objectName) {
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
