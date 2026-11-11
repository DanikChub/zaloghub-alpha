import { createRegexDealParser } from '../createRegexDealParser.js';
import {
  cleanInlineText,
  detectObjectType,
  getTelegramContactUrlFromPost,
  parseInterestRateMonthly,
  parseMoney,
} from '../parser.utils.js';

export const finExpertParser = createRegexDealParser({
  key: 'fin-expert',
  minConfidence: 0.4,

  fields: {
    address: {
      patterns: [/📍\s*Адрес:\s*([^\n]+)/i],
      transform: cleanInlineText,
      weight: 0.18,
    },

    objectName: {
      patterns: [/Объект:\s*([^\n]+)/i],
      transform: cleanInlineText,
      weight: 0.15,
    },

    loanAmount: {
      patterns: [/Сумма займа:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*[₽рР]/i],
      transform: parseMoney,
      weight: 0.35,
    },

    collateralValue: {
      patterns: [/Рыночная стоимость:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*[₽рР]/i],
      transform: parseMoney,
      weight: 0.12,
    },

    interestRateMonthly: {
      patterns: [/Ставка:\s*([^\n]+)/i],
      transform: parseInterestRateMonthly,
      weight: 0.05,
    },

    objectParams: {
      patterns: [/Результат проверки:\s*([\s\S]+?)(?=\n\s*👨🏻‍💻|\n\s*#|$)/i],
      transform: (value) => `Результат проверки: ${cleanInlineText(value)}`,
      weight: 0.05,
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
