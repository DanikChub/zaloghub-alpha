import { BadRequestException } from '@nestjs/common';
export type RawPublication = {
  sourceId: string;
  externalMessageId: string;
  albumId?: string;
  messageIds: string[];
  text: string;
  publishedAt: string;
  revisionAt: string;
};
export function rawPublication(value: unknown): RawPublication {
  if (!value || typeof value !== 'object')
    throw new BadRequestException('Ожидается сообщение');
  const v = value as Record<string, unknown>;
  for (const k of [
    'sourceId',
    'externalMessageId',
    'text',
    'publishedAt',
    'revisionAt',
  ]) {
    if (typeof v[k] !== 'string')
      throw new BadRequestException(`Некорректное поле ${k}`);
  }
  if (
    !(v.sourceId as string).length ||
    !/^\d+$/.test(v.externalMessageId as string) ||
    (v.text as string).length > 100000
  )
    throw new BadRequestException('Некорректное сообщение');
  if (
    v.albumId !== undefined &&
    (typeof v.albumId !== 'string' || !/^\d+$/.test(v.albumId))
  )
    throw new BadRequestException('Некорректный альбом');
  if (
    !Array.isArray(v.messageIds) ||
    !v.messageIds.length ||
    v.messageIds.length > 100 ||
    !v.messageIds.every((id) => typeof id === 'string' && /^\d+$/.test(id)) ||
    !v.messageIds.includes(v.externalMessageId)
  )
    throw new BadRequestException('Некорректные ID сообщений');
  for (const k of ['publishedAt', 'revisionAt'])
    if (
      !/^\d{4}-\d{2}-\d{2}T/.test(v[k] as string) ||
      !Number.isFinite(Date.parse(v[k] as string))
    )
      throw new BadRequestException(`Некорректная дата ${k}`);
  return v as RawPublication;
}
export function markInput(value: unknown): {
  saved?: boolean;
  hidden?: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Некорректная отметка');
  const v = value as Record<string, unknown>;
  if (
    !Object.keys(v).length ||
    Object.keys(v).some(
      (k) => !['saved', 'hidden'].includes(k) || typeof v[k] !== 'boolean',
    )
  )
    throw new BadRequestException('Ожидаются saved/hidden: boolean');
  return v as { saved?: boolean; hidden?: boolean };
}
export function integer(
  value: string | undefined,
  fallback: number,
  max: number,
) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || +value < 1 || +value > max)
    throw new BadRequestException('Некорректная страница/лимит');
  return +value;
}
export function range(min?: string, max?: string) {
  if (
    [min, max].some(
      (v) =>
        v !== undefined &&
        (!v.trim() || !Number.isFinite(+v) || +v < 0 || +v > 1e14),
    ) ||
    (min !== undefined && max !== undefined && +min > +max)
  )
    throw new BadRequestException('Некорректный диапазон');
  return min === undefined && max === undefined
    ? undefined
    : {
        ...(min !== undefined ? { gte: +min } : {}),
        ...(max !== undefined ? { lte: +max } : {}),
      };
}
