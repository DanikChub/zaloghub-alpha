import { describe, it, expect, vi } from 'vitest';
import { parseOffer } from './parse-offer.js';
import { parserRegistry } from './parsers/parser.registry.js';
import {
  parseInterestRateMonthly,
  parseMoney,
  parseLoanTermMonths,
} from './parsers/parser.utils.js';
const body =
  '🏢 Квартира\n🏠 Тип объекта: квартира\nОбъект: квартира\n📍 Адрес: г. Казань, ул. Тестовая, 1\n🌐 Адрес: г. Казань, ул. Тестовая, 1\n✅\nСумма займа: 2 500 000 ₽\nРыночная стоимость: 5 000 000 ₽\nСрок займа: 12 месяцев\nСрок: 12 месяцев\nСтавка: 36% годовых\nКонтакты: @broker_test';
describe('Обработчики предложений', () => {
  it('не искажает разделители тысяч, диапазоны и экстремальные расчёты', () => {
    expect(parseMoney('2.500.000')).toBe(2500000);
    expect(parseLoanTermMonths('6-12 месяцев')).toBeNull();
    const r = parseOffer(
      'zalog-doveriya',
      body
        .replace('2 500 000', '100000000000000')
        .replace('5 000 000', '0,01')
        .replace('36% годовых', '1000000% в месяц'),
      null,
    );
    expect(r.ltv).toBeNull();
    expect(r.monthlyIncome).toBeNull();
    expect(r.parseStatus).toBe('PARTIAL');
  });
  it.each([...parserRegistry.keys()])('перенесён формат %s', (key) => {
    const result = parseOffer(key, body, null);
    expect(result.loanAmount).toBe(2500000);
    expect(result.collateralValue).toBe(5000000);
    expect(result.ltv).toBe(50);
    expect(result.interestRateMonthly).toBe(3);
    expect(result.monthlyIncome).toBe(75000);
  });
  it('считает простой доход и сохраняет происхождение', () => {
    const r = parseOffer('zalog-doveriya', body, null);
    expect(r.totalIncome).toBe(900000);
    expect(r.declared.collateralValue).toBe(5000000);
    expect(r.calculated.rateBasis).toBe('annual/12');
    expect(r.inferred.city).toBe('Казань');
  });
  it('не подставляет 4% и не считает доход без ставки', () => {
    const r = parseOffer(
      'zalog-doveriya',
      body.replace('Ставка: 36% годовых', ''),
      null,
    );
    expect(r.interestRateMonthly).toBeNull();
    expect(r.monthlyIncome).toBeNull();
    expect(r.totalIncome).toBeNull();
    expect(r.ltv).toBe(50);
  });
  it('сохраняет неизвестные поля', () => {
    const r = parseOffer('zalog-doveriya', 'сообщение без параметров', null);
    expect(r.parseStatus).toBe('PARTIAL');
    expect(r.loanAmount).toBeNull();
    expect(r.ltv).toBeNull();
  });
  it('не подменяет явно заданные периоды ставки', () => {
    expect(parseInterestRateMonthly('3% годовых')).toBe(0.25);
    expect(parseInterestRateMonthly('60% в месяц')).toBe(60);
    for (const input of ['4%', 'от 3% в мес', '3–5% в мес'])
      expect(parseInterestRateMonthly(input)).toBeNull();
  });
  it('сохраняет десятичные суммы и множители', () => {
    expect(parseMoney('2,5 млн')).toBe(2500000);
    expect(parseMoney('150 000,50')).toBe(150000.5);
  });
  it('ошибка обработчика не выбрасывается и не уничтожает сообщение', () => {
    const parser = parserRegistry.get('air-if')!;
    const spy = vi.spyOn(parser, 'parse').mockImplementation(() => {
      throw new Error('fixture');
    });
    expect(parseOffer('air-if', 'исходный текст', null).parseStatus).toBe(
      'ERROR',
    );
    spy.mockRestore();
    expect(parseOffer('unknown', 'исходный текст', null).parseStatus).toBe(
      'ERROR',
    );
  });
});
