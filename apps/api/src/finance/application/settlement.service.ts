import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DealAccessService } from '../../deals/deal-access.service.js';
import { FinanceInstructionStore } from './finance-instruction.store.js';
import { SettlementAgreementDto } from '../dto/financial-instruction.dto.js';
import { contentHash } from '../calendar/russian-calendar.js';
import { quoteSettlement } from '../core/loan/settlement-quote.js';
import type { LoanTerms } from '../core/loan/loan.types.js';
import type { FinanceDeal } from '../infrastructure/deal-finance.mapper.js';
import { decimal } from '../core/money.js';

@Injectable()
export class SettlementService {
  constructor(
    private readonly access: DealAccessService,
    private readonly store: FinanceInstructionStore,
  ) {}
  private calculate(deal: FinanceDeal, on: string) {
    this.store.date(on, true);
    const finance = this.store.ready(deal, on);
    const terms = deal.financeTerms as LoanTerms;
    try {
      const quote = quoteSettlement(terms, finance);
      const termsHash = contentHash(terms);
      const liabilityHash = contentHash({
        on,
        termsHash,
        disbursedTotal: finance.disbursedTotal,
        interestTarget: quote.interestTarget,
        penaltyAccrued: finance.penaltyAccrued,
      });
      return {
        ...quote,
        quoteHash: contentHash({ quote, termsHash, liabilityHash }),
        liabilityHash,
        termsHash,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Ошибка расчёта закрытия',
      );
    }
  }
  async quote(userId: string, id: string, on: string) {
    return this.calculate(await this.access.one(userId, id), on);
  }
  agree(userId: string, id: string, dto: SettlementAgreementDto) {
    return this.access.withDealLock(userId, id, async (tx) => {
      const existing = await tx.financeInstruction.findUnique({
        where: {
          dealId_idempotencyKey: {
            dealId: id,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });
      if (existing) {
        const p = existing.payload as {
          quoteHash: string;
          agreementReference: string;
        };
        if (
          existing.kind !== 'SETTLEMENT' ||
          p.quoteHash !== dto.quoteHash ||
          p.agreementReference !== dto.agreementReference ||
          existing.effectiveOn.toISOString().slice(0, 10) !== dto.date
        )
          throw new ConflictException(
            'Ключ уже использован для другого соглашения',
          );
        return existing;
      }
      const quote = this.calculate(await this.store.load(tx, id), dto.date);
      if (quote.quoteHash !== dto.quoteHash)
        throw new ConflictException(
          'Расчёт закрытия изменился; получите новый расчёт',
        );
      return this.store.create(
        tx,
        userId,
        id,
        'SETTLEMENT',
        dto.date,
        dto.idempotencyKey,
        { ...quote, agreementReference: dto.agreementReference },
      );
    });
  }
  execute(userId: string, id: string, instructionId: string, date: string) {
    this.store.date(date);
    return this.access.withDealLock(userId, id, async (tx) => {
      const row = await this.store.find(tx, id, instructionId, 'SETTLEMENT');
      if (row.status === 'EXECUTED')
        return this.store.transition(tx, userId, id, row, 'EXECUTED', date);
      if (
        row.status !== 'AGREED' ||
        row.effectiveOn.toISOString().slice(0, 10) !== date
      )
        throw new ConflictException('Нужна согласованная дата закрытия');
      const current = this.calculate(await this.store.load(tx, id), date);
      const agreed = row.payload as { liabilityHash: string };
      if (current.liabilityHash !== agreed.liabilityHash)
        throw new ConflictException(
          'Условия или начисления изменились; согласуйте новый расчёт',
        );
      if (decimal(current.additionalPaymentRequired).greaterThan(0))
        throw new BadRequestException(
          'Недостаточно фактически полученных денег для закрытия',
        );
      const result = await this.store.transition(
        tx,
        userId,
        id,
        row,
        'EXECUTED',
        date,
      );
      await tx.deal.update({ where: { id }, data: { status: 'CLOSED' } });
      return result;
    });
  }
  cancel(userId: string, id: string, instructionId: string, date: string) {
    return this.access.withDealLock(userId, id, async (tx) =>
      this.store.transition(
        tx,
        userId,
        id,
        await this.store.find(tx, id, instructionId, 'SETTLEMENT'),
        'CANCELLED',
        date,
      ),
    );
  }
}
