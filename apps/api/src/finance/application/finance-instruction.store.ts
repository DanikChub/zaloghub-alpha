import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  FinanceInstructionKind,
  FinanceInstructionStatus,
} from '../../generated/prisma/enums.js';
import { dealInclude } from '../../deals/deal-query.js';
import {
  calculateDealFinance,
  financeToday,
  operationDate,
} from '../infrastructure/deal-finance.mapper.js';
import { contentHash } from '../calendar/russian-calendar.js';
import { validateLocalDate } from '../core/dates.js';

@Injectable()
export class FinanceInstructionStore {
  date(value: string, allowFuture = false) {
    try {
      validateLocalDate(value);
    } catch {
      throw new BadRequestException('Неверная календарная дата');
    }
    if (!allowFuture && value > financeToday())
      throw new BadRequestException(
        'Фактическое действие не может быть в будущем',
      );
  }
  load(tx: Prisma.TransactionClient, id: string) {
    return tx.deal.findUniqueOrThrow({ where: { id }, include: dealInclude });
  }
  ready(deal: Parameters<typeof calculateDealFinance>[0], on?: string) {
    const result = calculateDealFinance(deal, on);
    if (result.status !== 'READY')
      throw new BadRequestException('Сначала настройте финансовые условия');
    return result;
  }
  async existing(
    tx: Prisma.TransactionClient,
    id: string,
    key: string,
    kind: FinanceInstructionKind,
    date: string,
    payload: unknown,
  ) {
    if (!key) throw new BadRequestException('Нужен idempotencyKey');
    const row = await tx.financeInstruction.findUnique({
      where: { dealId_idempotencyKey: { dealId: id, idempotencyKey: key } },
    });
    if (
      row &&
      (row.kind !== kind ||
        operationDate(row.effectiveOn) !== date ||
        contentHash(row.payload) !== contentHash(payload))
    )
      throw new ConflictException(
        'Ключ уже использован для другого распоряжения',
      );
    return row;
  }
  async create(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    kind: FinanceInstructionKind,
    date: string,
    key: string,
    payload: Prisma.InputJsonObject,
  ) {
    const row = await tx.financeInstruction.create({
      data: {
        dealId: id,
        kind,
        effectiveOn: new Date(date),
        idempotencyKey: key,
        payload,
        actorId: userId,
      },
    });
    await this.audit(tx, userId, id, `${kind}_AGREED`, row.id, { payload });
    return row;
  }
  async find(
    tx: Prisma.TransactionClient,
    id: string,
    instructionId: string,
    kind: FinanceInstructionKind,
  ) {
    const row = await tx.financeInstruction.findFirst({
      where: { id: instructionId, dealId: id, kind },
    });
    if (!row) throw new NotFoundException('Распоряжение не найдено');
    return row;
  }
  async transition(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    row: Awaited<ReturnType<FinanceInstructionStore['find']>>,
    status: Exclude<FinanceInstructionStatus, 'AGREED'>,
    date: string,
    reference?: string,
  ) {
    this.date(date);
    if (status === 'EXECUTED' && date < operationDate(row.effectiveOn))
      throw new BadRequestException('Исполнение раньше согласования');
    if (row.status === status) {
      const saved = status === 'EXECUTED' ? row.executedOn : row.cancelledOn;
      if (
        saved &&
        operationDate(saved) === date &&
        (reference === undefined || reference === row.executionReference)
      )
        return row;
      throw new ConflictException(
        'Распоряжение уже завершено с другими данными',
      );
    }
    if (row.status !== 'AGREED')
      throw new ConflictException('Завершённое распоряжение нельзя изменить');
    const updated = await tx.financeInstruction.update({
      where: { id: row.id },
      data: {
        status,
        ...(status === 'EXECUTED'
          ? { executedOn: new Date(date), executionReference: reference }
          : { cancelledOn: new Date(date) }),
      },
    });
    await this.audit(tx, userId, id, `${row.kind}_${status}`, row.id, {
      date,
      ...(reference ? { reference } : {}),
    });
    return updated;
  }
  async audit(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    action: string,
    instructionId: string,
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
          entityType: 'Deal',
          entityId: id,
          action,
          details: { instructionId, ...details },
        },
      });
  }
}
