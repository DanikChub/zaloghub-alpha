import { createRegexDealParser } from '../createRegexDealParser.js';
import {
  cleanInlineText,
  detectObjectType,
  getTelegramContactUrlFromPost,
  parseInterestRateMonthly,
  parseLoanTermMonths,
  parseMoney,
} from '../parser.utils.js';

export const kreditConsultParser = createRegexDealParser({
  key: 'kredit-consult',
  minConfidence: 0.45,

  fields: {
    objectName: {
      patterns: [/🏢\s*(.+)/],
      transform: cleanInlineText,
      weight: 0.15,
    },

    address: {
      patterns: [/🅰️?\s*Адрес:\s*([\s\S]+?)(?=\n\s*(?:▶️|🔶|⏳|Узнать|$))/i],
      transform: cleanInlineText,
      weight: 0.18,
    },

    loanAmount: {
      patterns: [/Сумма займа:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*₽/i],
      transform: parseMoney,
      weight: 0.35,
    },

    collateralValue: {
      patterns: [/Рыночная стоимость:\s*([\d., \u00a0]+(?:млн|тыс)?)\s*₽/i],
      transform: parseMoney,
      weight: 0.12,
    },

    loanTermMonths: {
      patterns: [/Срок займа:\s*([^\n]+)/i],
      transform: parseLoanTermMonths,
      weight: 0.05,
    },

    interestRateMonthly: {
      patterns: [/Ставка:\s*([^\n]+)/i],
      transform: parseInterestRateMonthly,
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
