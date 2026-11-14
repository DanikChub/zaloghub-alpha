import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  type BorrowerVerification,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
export type Tx = Prisma.TransactionClient;
export type Permission = 'read' | 'write' | 'approve';
@Injectable()
export class VerificationAccessService {
  constructor(readonly db: PrismaService) {}
  async workspace(
    tx: Tx,
    actorId: string,
    workspaceId: string,
    permission: Permission = 'read',
  ) {
    const member = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: actorId } },
      include: { user: { select: { isActive: true } } },
    });
    if (!member || !member.user.isActive)
      throw new NotFoundException('Рабочее пространство не найдено');
    if (permission !== 'read' && member.role === 'VIEWER')
      throw new ForbiddenException('Нет права изменять проверку');
    if (permission === 'approve' && !['OWNER', 'ADMIN'].includes(member.role))
      throw new ForbiddenException(
        'Итоговое решение доступно владельцу или администратору',
      );
    return member;
  }
  async personalWorkspace(tx: Tx, actorId: string, requested?: string) {
    if (requested) {
      await this.workspace(tx, actorId, requested, 'write');
      return requested;
    }
    const ws = await tx.workspace.findUnique({
      where: { personalOwnerId: actorId },
    });
    if (!ws) throw new NotFoundException('Рабочее пространство не найдено');
    await this.workspace(tx, actorId, ws.id, 'write');
    return ws.id;
  }
  async verification(
    tx: Tx,
    actorId: string,
    id: string,
    permission: Permission = 'read',
    lock = false,
  ) {
    const row = await tx.borrowerVerification.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Проверка не найдена');
    await this.workspace(tx, actorId, row.workspaceId, permission);
    if (lock) {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM borrower_verifications WHERE id=${id} FOR UPDATE`,
      );
      return await tx.borrowerVerification.findUniqueOrThrow({ where: { id } });
    }
    return row;
  }
  mutable(row: BorrowerVerification) {
    if (['COMPLETED', 'CANCELLED'].includes(row.status))
      throw new ConflictException(
        'Проверка завершена. Создайте повторную проверку',
      );
  }
  async assignee(tx: Tx, workspaceId: string, userId: string) {
    const member = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { user: { select: { isActive: true } } },
    });
    if (!member || member.role === 'VIEWER' || !member.user.isActive)
      throw new BadRequestException(
        'Ответственный должен иметь право изменять данные в рабочем пространстве',
      );
  }
  async item(tx: Tx, verificationId: string, itemId: string) {
    const item = await tx.borrowerVerificationItem.findFirst({
      where: { id: itemId, verificationId },
    });
    if (!item) throw new NotFoundException('Пункт проверки не найден');
    return item;
  }
  async audit(
    tx: Tx,
    actorId: string | null,
    workspaceId: string,
    action: string,
    entityId: string,
    details: Prisma.InputJsonObject = {},
  ) {
    await tx.auditEntry.create({
      data: {
        workspaceId,
        actorId,
        action,
        entityId,
        entityType: 'BORROWER_VERIFICATION',
        details,
      },
    });
  }
  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(fn, {
          isolationLevel: 'ReadCommitted',
          timeout: 15000,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          const code =
            typeof error.meta?.code === 'string' ? error.meta.code : '';
          if (
            attempt < 2 &&
            (error.code === 'P2034' || code === '40P01' || code === '40001')
          )
            continue;
          if (error.code === 'P2002')
            throw new ConflictException('Запись с таким ключом уже существует');
          if (
            ['P2003', 'P2004', 'P2025'].includes(error.code) ||
            ['23514', '23503', '23505'].includes(code)
          )
            throw new ConflictException(
              'Операция нарушает состояние проверки или принадлежность связанных данных',
            );
        }
        throw error;
      }
    }
  }
  async write<T>(
    actorId: string,
    id: string,
    fn: (tx: Tx, row: BorrowerVerification) => Promise<T>,
    permission: Permission = 'write',
  ) {
    return this.transaction(async (tx) => {
      const row = await this.verification(tx, actorId, id, permission, true);
      this.mutable(row);
      await tx.borrowerVerification.update({
        where: { id },
        data: {
          status:
            row.status === 'READY_FOR_REVIEW' ? 'IN_PROGRESS' : row.status,
          updatedAt: new Date(
            Math.max(Date.now(), row.updatedAt.getTime() + 1),
          ),
        },
      });
      return fn(tx, row);
    });
  }
}
