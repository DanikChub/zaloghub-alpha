import { describe, expect, it } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { CreatePaymentDto } from './cash-operation.dto.js';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const parse = (amount: unknown, changes = {}) =>
  pipe.transform(
    { amount, date: '2026-01-25', ...changes },
    { type: 'body', metatype: CreatePaymentDto },
  );
describe('Вход ручного поступления', () => {
  it.each(['0.01', '0.1', '100.00', '9999999999999999.99'])(
    'принимает точную строковую сумму %s',
    async (amount) => {
      expect((await parse(amount)).amount).toBe(amount);
    },
  );
  it('сохраняет совместимость с небольшим JSON-числом', async () => {
    expect((await parse(123.45)).amount).toBe('123.45');
  });
  it.each([
    '0',
    '-1.00',
    '0.001',
    '1e6',
    '10000000000000000.00',
    null,
    {},
    1e16,
  ])('отклоняет некорректную сумму %s', async (amount) => {
    await expect(parse(amount)).rejects.toThrow();
  });
  it('не требует ручного назначения', async () => {
    expect((await parse('1.00')).type).toBeUndefined();
  });
  it('отклоняет время вместо календарной даты', async () => {
    await expect(
      parse('1.00', { date: '2026-01-25T12:00:00Z' }),
    ).rejects.toThrow();
  });
  it('отклоняет несуществующий день', async () => {
    await expect(parse('1.00', { date: '2026-02-30' })).rejects.toThrow();
  });
});
