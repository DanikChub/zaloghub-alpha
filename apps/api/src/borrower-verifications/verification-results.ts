import { BadRequestException } from '@nestjs/common';
import {
  type BorrowerCheckFinding,
  type BorrowerFindingType,
  type BorrowerIdentityMatch,
  Prisma,
} from '../generated/prisma/client.js';
import {
  array,
  choice,
  date,
  json,
  money,
  object,
  text,
  timestamp,
} from './verification.validation.js';
import { definition } from './verification.checklist.js';
export function httpUrl(
  value: unknown,
  field = 'sourceUrl',
): string | undefined {
  const raw = text(value, field, false, 2048);
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
      throw Error();
    return u.toString();
  } catch {
    throw new BadRequestException('Некорректная ссылка');
  }
}
export function findingInput(value: unknown) {
  const v = object(value, [
    'findingType',
    'externalId',
    'recordKey',
    'referenceNumber',
    'title',
    'categoryCode',
    'personRole',
    'recordStatus',
    'openedOn',
    'closedOn',
    'claimAmount',
    'outstandingAmount',
    'currency',
    'authorityName',
    'sourceUrl',
    'identityMatch',
    'matchBasis',
    'matchComment',
    'details',
  ]);
  const openedOn = date(v.openedOn, 'openedOn'),
    closedOn = date(v.closedOn, 'closedOn');
  if (openedOn && closedOn && closedOn < openedOn)
    throw new BadRequestException('Дата завершения раньше открытия');
  const claimAmount = money(v.claimAmount, 'claimAmount'),
    outstandingAmount = money(v.outstandingAmount, 'outstandingAmount');
  const currency = text(
    v.currency,
    'currency',
    Boolean(claimAmount || outstandingAmount),
    3,
  );
  if (currency && !/^[A-Z]{3}$/.test(currency))
    throw new BadRequestException('Некорректная валюта');
  return {
    findingType: choice<BorrowerFindingType>(
      v.findingType,
      ['COURT_CASE', 'ENFORCEMENT', 'BANKRUPTCY', 'LIST_MATCH', 'OTHER'],
      'findingType',
    ),
    recordKey: text(v.recordKey, 'recordKey', true, 200)!,
    title: text(v.title, 'title', true, 500)!,
    externalId: text(v.externalId, 'externalId', false, 200),
    referenceNumber: text(v.referenceNumber, 'referenceNumber', false, 200),
    categoryCode: text(v.categoryCode, 'categoryCode', false, 100),
    personRole: text(v.personRole, 'personRole', false, 100),
    recordStatus: text(v.recordStatus, 'recordStatus', false, 200),
    openedOn,
    closedOn,
    claimAmount,
    outstandingAmount,
    currency,
    authorityName: text(v.authorityName, 'authorityName', false, 500),
    sourceUrl: httpUrl(v.sourceUrl),
    identityMatch:
      v.identityMatch === undefined
        ? ('UNKNOWN' as const)
        : choice<BorrowerIdentityMatch>(
            v.identityMatch,
            ['CONFIRMED', 'POSSIBLE', 'REJECTED', 'UNKNOWN'],
            'identityMatch',
          ),
    matchBasis: json(v.matchBasis),
    matchComment: text(v.matchComment, 'matchComment', false),
    details: json(v.details),
  };
}
export function resultInput(value: unknown) {
  const v = object(value, [
    'resultBoolean',
    'resultCode',
    'resultAmount',
    'currency',
    'resultData',
    'summary',
    'coverage',
    'sourceAsOfAt',
    'validUntil',
    'findings',
    'evidenceIds',
  ]);
  if (v.resultBoolean !== undefined && typeof v.resultBoolean !== 'boolean')
    throw new BadRequestException('resultBoolean должен быть boolean');
  const resultAmount = money(v.resultAmount, 'resultAmount');
  const currency = text(v.currency, 'currency', resultAmount !== undefined, 3);
  if (currency && !/^[A-Z]{3}$/.test(currency))
    throw new BadRequestException('Некорректная валюта');
  const validUntil = timestamp(v.validUntil, 'validUntil');
  if (validUntil && validUntil <= new Date())
    throw new BadRequestException('Результат уже устарел');
  return {
    resultBoolean: v.resultBoolean as boolean | undefined,
    resultCode: text(v.resultCode, 'resultCode', false, 100),
    resultAmount,
    currency,
    resultData: json(v.resultData),
    summary: text(v.summary, 'summary', false),
    coverage: json(v.coverage),
    sourceAsOfAt: timestamp(v.sourceAsOfAt, 'sourceAsOfAt'),
    validUntil,
    findings:
      v.findings === undefined
        ? []
        : array(v.findings, 'findings').map(findingInput),
    evidenceIds:
      v.evidenceIds === undefined
        ? []
        : array(v.evidenceIds, 'evidenceIds', 30).map((x) =>
            text(x, 'evidenceId', true, 100)!,
          ),
  };
}
export type ResultInput = ReturnType<typeof resultInput>;
export function validateResult(code: string, result: ResultInput) {
  const d = definition(code);
  if (!d) throw new BadRequestException('Неизвестный пункт');
  if (
    (d.resultType !== 'BOOLEAN' && result.resultBoolean !== undefined) ||
    (d.resultType !== 'CATEGORY' && result.resultCode !== undefined) ||
    (!['MONEY', 'RECORD_LIST'].includes(d.resultType) &&
      result.resultAmount !== undefined)
  )
    throw new BadRequestException(
      'Формат ответа не соответствует типу проверки',
    );
  if (d.resultType === 'BOOLEAN' && typeof result.resultBoolean !== 'boolean')
    throw new BadRequestException('Необходим ответ Да / Нет');
  if (
    d.resultType === 'CATEGORY' &&
    (!result.resultCode || !d.categories?.includes(result.resultCode))
  )
    throw new BadRequestException('Выберите допустимую категорию результата');
  if (d.resultType === 'MONEY' && result.resultAmount === undefined)
    throw new BadRequestException(
      'Укажите сумму задолженности, включая нулевую',
    );
  if (
    d.resultType === 'RECORD_LIST' &&
    Object.keys(result.coverage).length === 0
  )
    throw new BadRequestException(
      'Укажите охват поиска, включая поиск без совпадений',
    );
  if (
    new Set(result.findings.map((f) => f.recordKey)).size !==
    result.findings.length
  )
    throw new BadRequestException('Повторяющиеся найденные записи');
}
export function assess(
  code: string,
  result: {
    resultBoolean?: boolean | null;
    resultCode?: string | null;
    resultAmount?: Prisma.Decimal | string | null;
  },
  findings: Pick<BorrowerCheckFinding, 'identityMatch'>[],
) {
  const d = definition(code)!;
  if (d.resultType === 'DOCUMENT') return 'NEEDS_REVIEW' as const;
  if (d.resultType === 'BOOLEAN')
    return result.resultBoolean === d.safeBoolean
      ? ('NOT_IDENTIFIED' as const)
      : ('IDENTIFIED' as const);
  if (d.resultType === 'MONEY')
    return new Prisma.Decimal(result.resultAmount ?? 0).gt(0)
      ? ('IDENTIFIED' as const)
      : ('NOT_IDENTIFIED' as const);
  if (d.resultType === 'CATEGORY')
    return [
      'CLEAR',
      'NO_RESTRICTIONS_IN_DOCUMENT',
      'NOT_REGISTERED',
      'ACTIVE',
      'TERMINATED',
    ].includes(result.resultCode ?? '')
      ? ('NOT_IDENTIFIED' as const)
      : result.resultCode === 'REQUIRES_REVIEW'
        ? ('NEEDS_REVIEW' as const)
        : ('IDENTIFIED' as const);
  if (findings.some((f) => f.identityMatch === 'CONFIRMED'))
    return 'IDENTIFIED' as const;
  if (findings.some((f) => ['UNKNOWN', 'POSSIBLE'].includes(f.identityMatch)))
    return 'NEEDS_REVIEW' as const;
  return 'NOT_IDENTIFIED' as const;
}
