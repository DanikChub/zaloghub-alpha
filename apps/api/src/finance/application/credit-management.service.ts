import { BadRequestException, Injectable } from '@nestjs/common';
import { DealAccessService } from '../../deals/deal-access.service.js';
import { FinanceInstructionStore } from './finance-instruction.store.js';
import {
  CreditAgreementDto,
  RefundRequestDto,
  RefundConfirmationDto,
} from '../dto/financial-instruction.dto.js';
import { decimal } from '../core/money.js';
import { CreditPreviewDto } from '../dto/credit-preview.dto.js';

@Injectable()
export class CreditManagementService {
  constructor(
    private readonly access: DealAccessService,
    private readonly store: FinanceInstructionStore,
  ) {}
  async credits(userId: string, id: string) {
    const result = this.store.ready(await this.access.one(userId, id));
    return {
      asOfOn: result.asOfOn,
      credits: result.credits,
      creditReservations: result.creditReservations,
      availableCredit: result.availableCredit,
      reservedCredit: result.reservedCredit,
      refundedTotal: result.refundedTotal,
      preferredAction: 'REFUND',
    };
  }
  async previewCredit(userId: string, id: string, dto: CreditPreviewDto) {
    this.store.date(dto.date);
    const result = this.store.ready(
      await this.access.one(userId, id),
      dto.date,
    );
    const available =
      result.credits.find((c) => c.receiptId === dto.receiptId)
        ?.availableAmount ?? '0';
    if (decimal(dto.amount).greaterThan(available))
      throw new BadRequestException('Недостаточно свободной переплаты');
    let remaining = decimal(dto.amount);
    const targets: { obligationKey: string; amount: string }[] = [];
    for (const obligation of result.snapshot.obligations.filter(
      (o) => o.component === 'INTEREST' && o.dueOn > dto.date,
    )) {
      if (remaining.isZero()) break;
      const pending = result.creditReservations
        .filter((r) => r.obligationKey === obligation.key)
        .reduce((sum, r) => sum.plus(r.amount), decimal('0'));
      const capacity = decimal(obligation.remainingAmount).minus(pending);
      if (capacity.lessThanOrEqualTo(0)) continue;
      const amount = remaining.lessThan(capacity) ? remaining : capacity;
      targets.push({
        obligationKey: obligation.key,
        amount: amount.toFixed(2),
      });
      remaining = remaining.minus(amount);
    }
    return {
      receiptId: dto.receiptId,
      targets,
      amountToAllocate: decimal(dto.amount).minus(remaining).toFixed(2),
      remainingForRefund: remaining.toFixed(2),
      requiresAgreement: true,
      preferredAction: 'REFUND',
    };
  }
  requestRefund(userId: string, id: string, dto: RefundRequestDto) {
    this.store.date(dto.date);
    const payload = {
      receiptId: dto.receiptId,
      amount: decimal(dto.amount).toFixed(2),
      comment: dto.comment ?? null,
    };
    return this.access.withDealLock(userId, id, async (tx) => {
      const existing = await this.store.existing(
        tx,
        id,
        dto.idempotencyKey,
        'REFUND',
        dto.date,
        payload,
      );
      if (existing) return existing;
      const finance = this.store.ready(await this.store.load(tx, id), dto.date);
      const available =
        finance.credits.find((c) => c.receiptId === dto.receiptId)
          ?.availableAmount ?? '0';
      if (decimal(available).lessThan(payload.amount))
        throw new BadRequestException(
          'Возврат возможен только из свободного остатка этого поступления',
        );
      return this.store.create(
        tx,
        userId,
        id,
        'REFUND',
        dto.date,
        dto.idempotencyKey,
        payload,
      );
    });
  }
  confirmRefund(
    userId: string,
    id: string,
    instructionId: string,
    dto: RefundConfirmationDto,
  ) {
    return this.access.withDealLock(userId, id, async (tx) =>
      this.store.transition(
        tx,
        userId,
        id,
        await this.store.find(tx, id, instructionId, 'REFUND'),
        'EXECUTED',
        dto.date,
        dto.transferReference,
      ),
    );
  }
  agreeCredit(userId: string, id: string, dto: CreditAgreementDto) {
    this.store.date(dto.date);
    const payload = {
      receiptId: dto.receiptId,
      targets: dto.targets.map((t) => ({
        obligationKey: t.obligationKey,
        amount: decimal(t.amount).toFixed(2),
      })),
      agreementReference: dto.agreementReference,
    };
    return this.access.withDealLock(userId, id, async (tx) => {
      const existing = await this.store.existing(
        tx,
        id,
        dto.idempotencyKey,
        'CREDIT',
        dto.date,
        payload,
      );
      if (existing) return existing;
      const finance = this.store.ready(await this.store.load(tx, id), dto.date);
      const available =
        finance.credits.find((c) => c.receiptId === dto.receiptId)
          ?.availableAmount ?? '0';
      const total = payload.targets.reduce(
        (sum, t) => sum.plus(t.amount),
        decimal('0'),
      );
      if (total.greaterThan(available))
        throw new BadRequestException(
          'Недостаточно свободного остатка для согласованного зачёта',
        );
      return this.store.create(
        tx,
        userId,
        id,
        'CREDIT',
        dto.date,
        dto.idempotencyKey,
        payload,
      );
    });
  }
  cancel(
    userId: string,
    id: string,
    instructionId: string,
    kind: 'REFUND' | 'CREDIT',
    date: string,
  ) {
    return this.access.withDealLock(userId, id, async (tx) =>
      this.store.transition(
        tx,
        userId,
        id,
        await this.store.find(tx, id, instructionId, kind),
        'CANCELLED',
        date,
      ),
    );
  }
}
