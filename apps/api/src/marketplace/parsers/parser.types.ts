import type { ParsedDealFields, RawMessage } from './types.js';
export type DealParserResult = {
  shouldSave: boolean;
  parsed: ParsedDealFields | null;
  reason?: string | null;
};
export type DealParser = {
  key: string;
  parse: (raw: RawMessage) => DealParserResult;
};
