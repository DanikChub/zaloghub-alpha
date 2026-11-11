import { DealParser } from './parser.types.js';
import { zalogDoveriyaParser } from './telegram/zalogDoveriya.parser.js';
import { mosinvestfinanceParser } from './telegram/mosinvestfinance.parser.js';
import { aktivKapitalParser } from './telegram/aktivKapital.parser.js';
import { finExpertParser } from './telegram/finExpert.parser.js';
import { kreditConsultParser } from './telegram/kreditConsult.parser.js';
import { airIfParser } from './telegram/airIf.parser.js';

export const parserRegistry = new Map<string, DealParser>([
  [zalogDoveriyaParser.key, zalogDoveriyaParser],
  [mosinvestfinanceParser.key, mosinvestfinanceParser],
  [aktivKapitalParser.key, aktivKapitalParser],
  [finExpertParser.key, finExpertParser],
  [kreditConsultParser.key, kreditConsultParser],
  [airIfParser.key, airIfParser],
]);
