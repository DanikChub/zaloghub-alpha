import type { DealParser } from './parser.types.js';
import type { ParsedDealFields } from './types.js';

type ParsedFieldKey = keyof ParsedDealFields;

type FieldConfig<T = unknown> = {
  patterns: RegExp[];
  transform?: (value: string) => T;
  weight?: number;
};

type RegexDealParserConfig = {
  key: string;
  minConfidence?: number;
  fields: Partial<Record<ParsedFieldKey, FieldConfig>>;
  derive?: (parsed: ParsedDealFields, text: string) => ParsedDealFields;
  isMinimumValid?: (parsed: ParsedDealFields) => boolean;
};

function createEmptyParsed(): ParsedDealFields {
  return {
    objectName: null,
    type: null,
    address: null,

    loanAmount: null,
    collateralValue: null,

    interestRateMonthly: null,
    interestRateMonthlySource: null,
    loanTermMonths: null,

    borrowerType: null,

    objectParams: null,
    contactUrl: null,
  };
}

export function createRegexDealParser(
  config: RegexDealParserConfig,
): DealParser {
  return {
    key: config.key,

    parse(raw) {
      const text = raw.text?.trim() ?? '';

      if (!text) {
        return {
          shouldSave: false,
          parsed: null,
          reason: 'empty_text',
        };
      }

      let confidence = 0;
      const reasons: string[] = [];
      let parsed = createEmptyParsed();

      for (const [field, fieldConfig] of Object.entries(config.fields)) {
        if (!fieldConfig) continue;

        for (const pattern of fieldConfig.patterns) {
          const match = text.match(pattern);
          const value = match?.[1];

          if (!value) continue;

          const finalValue = fieldConfig.transform
            ? fieldConfig.transform(value)
            : value.trim();

          if (
            finalValue === null ||
            finalValue === undefined ||
            finalValue === ''
          ) {
            continue;
          }

          Object.assign(parsed, { [field]: finalValue });

          confidence += fieldConfig.weight ?? 0.05;
          reasons.push(`${field} found`);

          break;
        }
      }

      if (config.derive) {
        parsed = config.derive(parsed, text);
      }

      if (confidence > 1) confidence = 1;

      const hasMinimumRequiredData = config.isMinimumValid
        ? config.isMinimumValid(parsed)
        : parsed.loanAmount !== null &&
          (parsed.address !== null ||
            parsed.objectName !== null ||
            parsed.type !== null);

      if (!hasMinimumRequiredData) {
        reasons.push('minimum required fields not satisfied');
      }

      const shouldSave =
        hasMinimumRequiredData && confidence >= (config.minConfidence ?? 0.4);

      return {
        shouldSave,
        parsed,
        reason: shouldSave ? null : reasons.join(', '),
      };
    },
  };
}
