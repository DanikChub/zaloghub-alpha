import type {
  BorrowerCheckResultType,
  PartyIdentityVersion,
} from '../generated/prisma/client.js';
export const CHECKLIST_VERSION = 'borrower-v1';
export const RISK_RULES_VERSION = 'borrower-rules-v1';
export type CheckDefinition = {
  code: string;
  title: string;
  resultType: BorrowerCheckResultType;
  required: boolean;
  fields: (keyof PartyIdentityVersion)[];
  url?: string;
  instruction: string;
  safeBoolean?: boolean;
  categories?: string[];
  documentRequired?: boolean;
};
const check = (
  code: string,
  title: string,
  resultType: BorrowerCheckResultType,
  fields: CheckDefinition['fields'],
  url?: string,
  extra: Partial<CheckDefinition> = {},
): CheckDefinition => ({
  code,
  title,
  resultType,
  fields,
  url,
  required: true,
  instruction:
    'Выполните проверку, сохраните результат и подтверждающие документы. При совпадении ФИО уточните принадлежность записи заёмщику.',
  ...extra,
});
export const CHECKS: CheckDefinition[] = [
  check(
    'PASSPORT_VALIDITY',
    'Действительность паспорта',
    'BOOLEAN',
    ['passportSeries', 'passportNumber', 'passportIssuedOn'],
    undefined,
    { safeBoolean: true, documentRequired: true },
  ),
  check(
    'IDENTITY_MATCH',
    'Соответствие паспорта заёмщику',
    'BOOLEAN',
    ['firstName', 'lastName', 'birthDate'],
    undefined,
    { safeBoolean: true, documentRequired: true },
  ),
  check(
    'INN_MATCH',
    'Соответствие ИНН заёмщику',
    'BOOLEAN',
    ['inn', 'firstName', 'lastName', 'birthDate'],
    'https://service.nalog.ru/inn.do',
    { safeBoolean: true, documentRequired: true },
  ),
  check('SNILS_DOCUMENT', 'СНИЛС предоставлен', 'DOCUMENT', [], undefined, {
    required: false,
  }),
  check(
    'BANKRUPTCY_EFRSB',
    'Банкротство — ЕФРСБ',
    'RECORD_LIST',
    ['inn'],
    'https://bankrot.fedresurs.ru/',
  ),
  check(
    'BANKRUPTCY_KAD',
    'Дела о банкротстве — КАД',
    'RECORD_LIST',
    ['inn'],
    'https://kad.arbitr.ru/',
  ),
  check(
    'FSSP',
    'Исполнительные производства',
    'RECORD_LIST',
    ['firstName', 'lastName', 'birthDate'],
    'https://fssp.gov.ru/iss/ip',
  ),
  check(
    'ARBITRATION',
    'Арбитражные споры',
    'RECORD_LIST',
    ['inn'],
    'https://kad.arbitr.ru/',
  ),
  check(
    'GENERAL_COURTS',
    'Суды общей юрисдикции и мировые судьи',
    'RECORD_LIST',
    ['firstName', 'lastName', 'birthDate'],
    'https://sudrf.ru/',
  ),
  check(
    'CRIMINAL_CERTIFICATE',
    'Справка МВД о судимости',
    'CATEGORY',
    [],
    'https://www.gosuslugi.ru/600103/1/form',
    {
      categories: [
        'CLEAR',
        'RECORDS_PRESENT',
        'INVESTIGATION',
        'REQUIRES_REVIEW',
      ],
      documentRequired: true,
    },
  ),
  check(
    'CAPACITY',
    'Сведения об ограничении дееспособности',
    'CATEGORY',
    [],
    undefined,
    {
      categories: [
        'NO_RESTRICTIONS_IN_DOCUMENT',
        'RESTRICTED',
        'INCAPACITATED',
        'REQUIRES_REVIEW',
      ],
      documentRequired: true,
    },
  ),
  check(
    'TAX_DEBT',
    'Налоговая задолженность',
    'MONEY',
    ['inn'],
    'https://lkfl2.nalog.ru/',
    { documentRequired: true },
  ),
  check(
    'FINES',
    'Неоплаченные штрафы в проверенных источниках',
    'MONEY',
    [],
    'https://www.gosuslugi.ru/',
    { documentRequired: true },
  ),
  check(
    'ROSFIN',
    'Перечни Росфинмониторинга',
    'RECORD_LIST',
    ['firstName', 'lastName', 'birthDate'],
    'https://fedsfm.ru/documents/terr-list',
  ),
  check(
    'ENTREPRENEUR_STATUS',
    'Статус индивидуального предпринимателя',
    'CATEGORY',
    ['inn'],
    'https://egrul.nalog.ru/',
    {
      required: false,
      categories: ['ACTIVE', 'TERMINATED', 'NOT_REGISTERED', 'REQUIRES_REVIEW'],
      documentRequired: true,
    },
  ),
  check(
    'DISQUALIFICATION',
    'Дисквалификация',
    'RECORD_LIST',
    ['firstName', 'lastName', 'birthDate'],
    'https://service.nalog.ru/disqualified.do',
    { required: false },
  ),
  check('PND_CERTIFICATE', 'Справка ПНД', 'DOCUMENT', [], undefined, {
    required: false,
  }),
  check('ND_CERTIFICATE', 'Справка НД', 'DOCUMENT', [], undefined, {
    required: false,
  }),
  check(
    'PSYCHIATRIST_REPORT',
    'Заключение психиатра',
    'DOCUMENT',
    [],
    undefined,
    { required: false },
  ),
];
export function definition(code: string) {
  return CHECKS.find((c) => c.code === code);
}
export function missingFields(
  check: CheckDefinition,
  identity: PartyIdentityVersion | null,
) {
  if (!identity) return ['identity'];
  return check.fields.filter(
    (field) => identity[field] === null || identity[field] === '',
  );
}
