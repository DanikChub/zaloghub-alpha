import type { FinancialEvent, LocalDate } from './finance.types.js';

import { validateLocalDate } from './dates.js';
import { validateEvents } from './validate-events.js';

export function prepareEvents(
  events: readonly FinancialEvent[],
  asOfOn: LocalDate,
): readonly FinancialEvent[] {
  validateLocalDate(asOfOn);
  validateEvents(events);

  return events
    .filter((event) => event.effectiveOn <= asOfOn)
    .map((event) => ({ ...event }))
    .sort((left, right) => {
      if (left.effectiveOn < right.effectiveOn) {
        return -1;
      }

      if (left.effectiveOn > right.effectiveOn) {
        return 1;
      }

      return left.sequenceNo - right.sequenceNo;
    });
}
