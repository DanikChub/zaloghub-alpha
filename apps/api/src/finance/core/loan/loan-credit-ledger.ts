import type { ReceiptEvent } from '../finance.types.js';
import type {
  ObligationAllocation,
  PaymentObligation,
} from '../obligations/obligation.types.js';
import type { LoanAction, ReceiptCredit } from './loan-action.types.js';
import { decimal } from '../money.js';
import { validateLocalDate } from '../dates.js';
import { validateMoney } from '../validate-money.js';

export function prepareLoanActions(
  actions: readonly LoanAction[] = [],
  asOfOn: string,
): LoanAction[] {
  if (!Array.isArray(actions) || actions.length > 10000)
    throw new Error('Некорректные финансовые действия');
  const ids = new Set<string>();
  for (const action of actions) {
    if (
      !action ||
      typeof action.id !== 'string' ||
      !action.id.trim() ||
      ids.has(action.id)
    )
      throw new Error('Повтор или пустой ID финансового действия');
    ids.add(action.id);
    validateLocalDate(action.effectiveOn);
    if (!Number.isSafeInteger(action.sequenceNo) || action.sequenceNo < 1)
      throw new Error('Некорректный порядок финансового действия');
    if (action.kind === 'REFUND_REQUEST') {
      validateMoney(action.amount, false);
      if (!action.receiptId) throw new Error('Не задано исходное поступление');
    } else if (action.kind === 'CREDIT') {
      if (
        !action.receiptId ||
        !Array.isArray(action.targets) ||
        !action.targets.length ||
        new Set(
          action.targets.map((t: { obligationKey: string }) => t.obligationKey),
        ).size !== action.targets.length
      )
        throw new Error('Неверные периоды зачёта');
      for (const target of action.targets) {
        validateMoney(target.amount, false);
        if (!target.obligationKey) throw new Error('Не задан период зачёта');
      }
    } else if (
      !['REFUND', 'CANCEL_REFUND', 'CANCEL_CREDIT', 'SETTLEMENT'].includes(
        action.kind,
      )
    )
      throw new Error('Неизвестное финансовое действие');
  }
  return actions
    .filter((a) => a.effectiveOn <= asOfOn)
    .slice()
    .sort(
      (a, b) =>
        a.effectiveOn.localeCompare(b.effectiveOn) ||
        Number(a.kind === 'SETTLEMENT') - Number(b.kind === 'SETTLEMENT') ||
        a.sequenceNo - b.sequenceNo ||
        a.id.localeCompare(b.id),
    );
}

/** Защищает согласованные/возвращаемые средства от ретроактивного перераспределения. */
export function protectedReceiptAmounts(
  actions: readonly LoanAction[],
): Map<string, string> {
  const committed = new Map<string, ReturnType<typeof decimal>>(),
    peaks = new Map<string, string>();
  const refs = new Map<string, { receiptId: string; amount: string }>();
  for (const action of actions) {
    let receiptId: string, amount: ReturnType<typeof decimal>;
    if (action.kind === 'REFUND_REQUEST' || action.kind === 'CREDIT') {
      receiptId = action.receiptId;
      amount =
        action.kind === 'REFUND_REQUEST'
          ? decimal(action.amount)
          : action.targets.reduce((sum, t) => sum.plus(t.amount), decimal('0'));
      refs.set(action.id, { receiptId, amount: amount.toFixed(2) });
    } else if (
      action.kind === 'CANCEL_REFUND' ||
      action.kind === 'CANCEL_CREDIT'
    ) {
      const ref = refs.get(action.instructionId);
      if (!ref) throw new Error('Отмена неизвестного распоряжения');
      receiptId = ref.receiptId;
      amount = decimal(ref.amount).negated();
    } else continue;
    const total = (committed.get(receiptId) ?? decimal('0')).plus(amount);
    committed.set(receiptId, total);
    if (total.greaterThan(peaks.get(receiptId) ?? '0'))
      peaks.set(receiptId, total.toFixed(2));
  }
  return peaks;
}

export class LoanCreditLedger {
  private readonly receipts = new Map<string, ReceiptEvent>();
  private readonly refunded = new Map<string, string>();
  private readonly refunds = new Map<
    string,
    { receiptId: string; amount: string }
  >();
  private readonly credits = new Map<
    string,
    {
      receiptId: string;
      targets: { obligationKey: string; amount: string }[];
      used: boolean;
    }
  >();
  constructor(private readonly allocations: ObligationAllocation[]) {}
  receive(receipt: ReceiptEvent) {
    this.receipts.set(receipt.id, receipt);
  }
  private paid(receiptId: string) {
    return this.allocations
      .filter((a) => a.paymentId === receiptId)
      .reduce((sum, a) => sum.plus(a.amount), decimal('0'));
  }
  private reserve(receiptId: string, kind: 'refund' | 'credit') {
    return kind === 'refund'
      ? [...this.refunds.values()]
          .filter((r) => r.receiptId === receiptId)
          .reduce((sum, r) => sum.plus(r.amount), decimal('0'))
      : [...this.credits.values()]
          .filter((r) => r.receiptId === receiptId)
          .flatMap((r) => r.targets)
          .reduce((sum, t) => sum.plus(t.amount), decimal('0'));
  }
  available(receiptId: string) {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) throw new Error('Неизвестное исходное поступление');
    return decimal(receipt.amount)
      .minus(this.paid(receiptId))
      .minus(this.refunded.get(receiptId) ?? '0')
      .minus(this.reserve(receiptId, 'refund'))
      .minus(this.reserve(receiptId, 'credit'));
  }
  apply(
    action: Exclude<LoanAction, { kind: 'SETTLEMENT' }>,
    target: (key: string) => PaymentObligation,
  ) {
    if (action.kind === 'REFUND_REQUEST') {
      if (this.available(action.receiptId).lessThan(action.amount))
        throw new Error('Недостаточно свободной переплаты для возврата');
      this.refunds.set(action.id, {
        receiptId: action.receiptId,
        amount: action.amount,
      });
    } else if (action.kind === 'REFUND' || action.kind === 'CANCEL_REFUND') {
      const request = this.refunds.get(action.instructionId);
      if (!request) throw new Error('Неизвестный или уже исполненный возврат');
      this.refunds.delete(action.instructionId);
      if (action.kind === 'REFUND')
        this.refunded.set(
          request.receiptId,
          decimal(this.refunded.get(request.receiptId) ?? '0')
            .plus(request.amount)
            .toFixed(2),
        );
    } else if (action.kind === 'CREDIT') {
      const amount = action.targets.reduce(
        (sum, t) => sum.plus(t.amount),
        decimal('0'),
      );
      if (this.available(action.receiptId).lessThan(amount))
        throw new Error('Недостаточно свободной переплаты для зачёта');
      for (const entry of action.targets) {
        const obligation = target(entry.obligationKey);
        const other = [...this.credits.values()]
          .flatMap((c) => c.targets)
          .filter((t) => t.obligationKey === entry.obligationKey)
          .reduce((s, t) => s.plus(t.amount), decimal('0'));
        const paid = this.allocations
          .filter((a) => a.obligationKey === entry.obligationKey)
          .reduce((s, a) => s.plus(a.amount), decimal('0'));
        if (
          obligation.component !== 'INTEREST' ||
          obligation.dueOn < action.effectiveOn ||
          decimal(obligation.amount)
            .minus(paid)
            .minus(other)
            .lessThan(entry.amount)
        )
          throw new Error(
            'Зачёт превышает непогашенный будущий процентный платёж',
          );
      }
      this.credits.set(action.id, {
        receiptId: action.receiptId,
        targets: action.targets.map((t) => ({ ...t })),
        used: false,
      });
    } else if (action.kind === 'CANCEL_CREDIT') {
      const credit = this.credits.get(action.instructionId);
      if (!credit || credit.used)
        throw new Error('Можно отменить только ещё не применённый зачёт');
      this.credits.delete(action.instructionId);
    }
  }
  activate(day: string, target: (key: string) => PaymentObligation) {
    for (const credit of this.credits.values())
      for (const entry of credit.targets) {
        if (decimal(entry.amount).isZero()) continue;
        const obligation = target(entry.obligationKey);
        if (obligation.periodFromOn === null || obligation.periodFromOn > day)
          continue;
        const planned = decimal(entry.amount);
        entry.amount = '0.00';
        credit.used = true;
        const paid = this.allocations
          .filter((a) => a.obligationKey === entry.obligationKey)
          .reduce((s, a) => s.plus(a.amount), decimal('0'));
        const remaining = decimal(obligation.amount).minus(paid);
        const amount = planned.lessThan(remaining) ? planned : remaining;
        if (amount.greaterThan(0))
          this.allocate(
            credit.receiptId,
            entry.obligationKey,
            amount.toFixed(2),
            day,
          );
      }
  }
  allocate(receiptId: string, key: string, amount: string, day: string) {
    if (this.available(receiptId).lessThan(amount))
      throw new Error('Превышена сумма исходного поступления');
    const orderNo =
      Math.max(
        0,
        ...this.allocations
          .filter((a) => a.paymentId === receiptId)
          .map((a) => a.orderNo),
      ) + 1;
    this.allocations.push({
      id: `${receiptId}:allocation:${orderNo}`,
      paymentId: receiptId,
      obligationKey: key,
      effectiveOn: day,
      orderNo,
      amount,
    });
  }
  releaseFutureCredits() {
    for (const credit of this.credits.values())
      for (const target of credit.targets) target.amount = '0.00';
  }
  reservations() {
    return [...this.credits.entries()].flatMap(([instructionId, c]) =>
      c.targets
        .filter((t) => decimal(t.amount).greaterThan(0))
        .map((t) => ({ instructionId, receiptId: c.receiptId, ...t })),
    );
  }
  fund(key: string, amount: string, day: string) {
    let left = decimal(amount);
    for (const receipt of this.receipts.values()) {
      if (left.isZero()) break;
      const available = this.available(receipt.id);
      const part = available.lessThan(left) ? available : left;
      if (part.greaterThan(0)) {
        this.allocate(receipt.id, key, part.toFixed(2), day);
        left = left.minus(part);
      }
    }
    if (left.greaterThan(0))
      throw new Error(
        'Недостаточно поступивших денег для согласованного закрытия',
      );
  }
  snapshot(): ReceiptCredit[] {
    return [...this.receipts.keys()].map((receiptId) => ({
      receiptId,
      refundedAmount: this.refunded.get(receiptId) ?? '0.00',
      remainingAmount: decimal(this.receipts.get(receiptId)!.amount)
        .minus(this.paid(receiptId))
        .minus(this.refunded.get(receiptId) ?? '0')
        .toFixed(2),
      reservedForRefund: this.reserve(receiptId, 'refund').toFixed(2),
      reservedForFuture: this.reserve(receiptId, 'credit').toFixed(2),
      availableAmount: this.available(receiptId).toFixed(2),
    }));
  }
}
