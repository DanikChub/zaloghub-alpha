import type { FinancialEvent } from './finance.types.js';
import { validateLocalDate } from './dates.js';
import { decimal } from './money.js';

export function validateEvents(events: readonly FinancialEvent[]): void {
  if (!Array.isArray(events)) {
    throw new Error('События должны передаваться массивом');
  }

  const ids = new Set<string>();
  const positions = new Set<string>();

  for (const event of events) {
    if (typeof event !== 'object' || event === null) {
      throw new Error('Событие должно быть объектом');
    }

    const { id, kind, effectiveOn, sequenceNo, amount } = event;

    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('У события отсутствует идентификатор');
    }

    if (ids.has(id)) {
      throw new Error(`Повторный идентификатор события: ${id}`);
    }

    if (kind !== 'DISBURSEMENT' && kind !== 'RECEIPT') {
      throw new Error(`Неподдерживаемый тип события: ${kind}`);
    }

    validateLocalDate(effectiveOn);

    if (!Number.isSafeInteger(sequenceNo) || sequenceNo < 1) {
      throw new Error(`Некорректный порядок события: ${id}`);
    }

    const position = `${effectiveOn}:${sequenceNo}`;

    if (positions.has(position)) {
      throw new Error(`Повторный порядок событий: ${position}`);
    }

    if (
      typeof amount !== 'string' ||
      !/^(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(amount) ||
      !decimal(amount).greaterThan('0')
    ) {
      throw new Error(`Некорректная сумма события: ${id}`);
    }

    ids.add(id);
    positions.add(position);
  }
}
