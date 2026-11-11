import { describe, it, expect } from 'vitest';
import {
  rawPublication,
  markInput,
  range,
  integer,
} from './marketplace.validation.js';
describe('Границы API', () => {
  const raw = {
    sourceId: 's',
    externalMessageId: '1',
    messageIds: ['1'],
    text: '',
    publishedAt: '2026-11-08T00:00:00Z',
    revisionAt: '2026-11-08T00:00:00Z',
  };
  it('принимает публикацию без текста', () =>
    expect(rawPublication(raw)).toEqual(raw));
  it('отвергает некорректные даты и идентификаторы', () => {
    expect(() => rawPublication({ ...raw, revisionAt: 'bad' })).toThrow();
    expect(() => rawPublication({ ...raw, messageIds: ['2'] })).toThrow();
  });
  it('не позволяет назначить другого владельца отметки', () => {
    expect(() => markInput({ userId: 'other', saved: true })).toThrow();
    expect(() => markInput({ saved: 'true' })).toThrow();
    expect(markInput({ saved: false })).toEqual({ saved: false });
  });
  it('проверяет фильтры и пагинацию', () => {
    expect(() => range('9', '1')).toThrow();
    expect(() => range('NaN')).toThrow();
    expect(() => integer('0', 1, 60)).toThrow();
    expect(range('0', '50')).toEqual({ gte: 0, lte: 50 });
  });
});
