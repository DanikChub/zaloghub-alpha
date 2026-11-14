import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';

export type Obj = Record<string, unknown>;
export function object(value: unknown, allowed?: readonly string[]): Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Ожидается объект');
  const result = value as Obj;
  if (allowed && Object.keys(result).some((k) => !allowed.includes(k)))
    throw new BadRequestException('Неизвестное поле запроса');
  return result;
}
export function text(
  value: unknown,
  field: string,
  required = true,
  max = 4000,
): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new BadRequestException(`Необходимо поле ${field}`);
    return undefined;
  }
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new BadRequestException(`Некорректное поле ${field}`);
  return value.trim();
}
export function choice<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T))
    throw new BadRequestException(`Некорректное поле ${field}`);
  return value as T;
}
export function date(
  value: unknown,
  field: string,
  required = false,
): Date | undefined {
  const raw = text(value, field, required, 10);
  if (!raw) return undefined;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== raw
  )
    throw new BadRequestException(`Некорректная дата ${field}`);
  return parsed;
}
export function timestamp(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = text(value, field)!;
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw) ||
    !Number.isFinite(Date.parse(raw))
  )
    throw new BadRequestException(`Некорректное время ${field}`);
  return new Date(raw);
}
export function money(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== 'string' ||
    !/^(?:0|[1-9]\d{0,17})(?:\.\d{1,2})?$/.test(value)
  )
    throw new BadRequestException(
      `${field}: ожидается неотрицательная сумма строкой с точностью до копеек`,
    );
  return value;
}
export function json(
  value: unknown,
  fallback: Obj = {},
): Prisma.InputJsonObject {
  const v = value === undefined ? fallback : object(value);
  if (JSON.stringify(v).length > 65536)
    throw new BadRequestException('Слишком большой объект');
  return v as Prisma.InputJsonObject;
}
export function array(value: unknown, field: string, limit = 100): unknown[] {
  if (!Array.isArray(value) || value.length > limit)
    throw new BadRequestException(`Некорректный список ${field}`);
  return value;
}
export function page(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'string' ||
    !/^\d+$/.test(value) ||
    +value < 1 ||
    +value > max
  )
    throw new BadRequestException('Некорректная пагинация');
  return +value;
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  return value;
}
export const hash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
export function key(value: unknown) {
  return text(value, 'Idempotency-Key', true, 120)!;
}
export const jsonSafe = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_, v: unknown) =>
      typeof v === 'bigint' ? v.toString() : v,
    ),
  ) as T;
