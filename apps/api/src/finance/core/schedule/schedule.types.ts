import type { LocalDate } from '../finance.types.js';

/**
 * Что делать, если выбранного числа нет в месяце.
 * Например, день платежа 31, а в феврале 28 дней.
 */
export type MissingPaymentDayPolicy =
    | 'LAST_DAY_OF_MONTH'
    | 'REJECT';

export interface InterestScheduleInput {
    /** Дата начала начисления, не обязательно дата договора. */
    readonly accrualStartOn: LocalDate;

    /** Первая плановая дата оплаты, не дата фактического перевода. */
    readonly firstPaymentOn: LocalDate;

    /** Договорный день ежемесячного платежа. */
    readonly paymentDay: number;

    /** Конечная дата возврата займа. */
    readonly maturityOn: LocalDate;

    readonly missingPaymentDay: MissingPaymentDayPolicy;
}

export interface InterestSchedulePeriod {
    /** Устойчивый ключ периода для привязки погашений. */
    readonly key: string;

    readonly sequenceNo: number;

    /** Начало периода включительно. */
    readonly fromOn: LocalDate;

    /** Конец периода, не включается в начисление. */
    readonly toOnExclusive: LocalDate;

    /** Плановая календарная дата оплаты. */
    readonly dueOn: LocalDate;

    readonly days: number;

    readonly isFirst: boolean;
    readonly isFinal: boolean;

    /** Полный цикл между соседними месячными датами оплаты. */
    readonly isFullMonthlyPeriod: boolean;
}