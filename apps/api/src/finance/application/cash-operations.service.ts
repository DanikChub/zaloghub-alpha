import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DealAccessService } from '../../deals/deal-access.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  CreateOperationDto,
  CreatePaymentDto,
} from '../dto/cash-operation.dto.js';
import {
  financeToday,
  operationDate,
} from '../infrastructure/deal-finance.mapper.js';
@Injectable()
export class CashOperationsService {
  constructor(private readonly access: DealAccessService) {}
  async disburse(userId: string, id: string, dto: CreateOperationDto) {
    return this.cashOperation(userId, id, 'DISBURSEMENT', dto);
  }

  async pay(userId: string, id: string, dto: CreatePaymentDto) {
    return this.cashOperation(userId, id, 'RECEIPT', dto);
  }

  async deleteDisbursement(userId: string, id: string, operationId: string) {
    return this.access.withDealLock(userId, id, async (tx) => {
      const operation = await tx.disbursement.findFirst({
        where: { id: operationId, dealId: id },
      });
      if (!operation) throw new NotFoundException('Выдача не найдена');
      if (!operation.voidedAt) {
        await tx.disbursement.update({
          where: { id: operationId },
          data: { voidedAt: new Date() },
        });
        await this.auditOperation(tx, userId, id, 'DISBURSEMENT_VOIDED', {
          operationId,
        });
      }
      return { success: true };
    });
  }

  async deletePayment(userId: string, id: string, operationId: string) {
    return this.access.withDealLock(userId, id, async (tx) => {
      const operation = await tx.payment.findFirst({
        where: { id: operationId, dealId: id },
      });
      if (!operation) throw new NotFoundException('Платёж не найден');
      if (!operation.voidedAt) {
        await tx.payment.update({
          where: { id: operationId },
          data: { voidedAt: new Date() },
        });
        await this.auditOperation(tx, userId, id, 'RECEIPT_VOIDED', {
          operationId,
        });
      }
      return { success: true };
    });
  }

  private async cashOperation(
    userId: string,
    id: string,
    kind: 'RECEIPT' | 'DISBURSEMENT',
    dto: CreateOperationDto,
  ) {
    if (dto.date > financeToday())
      throw new BadRequestException(
        'Фактическая операция не может быть в будущем',
      );
    return this.access.withDealLock(userId, id, async (tx) => {
      const existing = dto.idempotencyKey
        ? kind === 'RECEIPT'
          ? await tx.payment.findUnique({
              where: {
                dealId_idempotencyKey: {
                  dealId: id,
                  idempotencyKey: dto.idempotencyKey,
                },
              },
            })
          : await tx.disbursement.findUnique({
              where: {
                dealId_idempotencyKey: {
                  dealId: id,
                  idempotencyKey: dto.idempotencyKey,
                },
              },
            })
        : null;
      if (existing) {
        const date = 'paidAt' in existing ? existing.paidAt : existing.issuedAt;
        if (
          existing.voidedAt ||
          !existing.amount.equals(dto.amount) ||
          operationDate(date) !== dto.date ||
          (existing.comment ?? null) !== (dto.comment ?? null)
        )
          throw new ConflictException(
            'Ключ запроса уже использован для другой или отменённой операции',
          );
        return existing;
      }
      const data = {
        dealId: id,
        amount: dto.amount,
        comment: dto.comment,
        idempotencyKey: dto.idempotencyKey,
      };
      const operation =
        kind === 'RECEIPT'
          ? await tx.payment.create({
              data: { ...data, paidAt: new Date(dto.date), type: 'OTHER' },
            })
          : await tx.disbursement.create({
              data: { ...data, issuedAt: new Date(dto.date) },
            });
      await this.auditOperation(tx, userId, id, `${kind}_RECORDED`, {
        operationId: operation.id,
        amount: dto.amount,
        effectiveOn: dto.date,
      });
      return operation;
    });
  }

  private async auditOperation(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    action: string,
    details: Prisma.InputJsonObject,
  ) {
    const deal = await tx.deal.findUniqueOrThrow({
      where: { id },
      select: { workspaceId: true },
    });
    if (deal.workspaceId)
      await tx.auditEntry.create({
        data: {
          workspaceId: deal.workspaceId,
          actorId: userId,
          action,
          entityType: 'Deal',
          entityId: id,
          details,
        },
      });
  }
}
