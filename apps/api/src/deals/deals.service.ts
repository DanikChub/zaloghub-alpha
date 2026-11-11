import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { DealStatus } from '../generated/prisma/enums.js';
import { CreateDealDto } from './dto/create-deal.dto.js';
import { BorrowersService } from '../borrowers/borrowers.service.js';
import { CollateralsService } from '../collaterals/collaterals.service.js';
import { DealAccessService } from './deal-access.service.js';
import { dealInclude } from './deal-query.js';
@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly borrowers: BorrowersService,
    private readonly collaterals: CollateralsService,
    private readonly access: DealAccessService,
  ) {}
  async validateLinks(
    userId: string,
    data: { borrowerId?: string | null; collateralId?: string | null },
  ) {
    if (data.borrowerId) await this.borrowers.one(userId, data.borrowerId);
    if (data.collateralId)
      await this.collaterals.one(userId, data.collateralId);
  }

  validateStatus(
    data: {
      status?: string;
      borrowerId?: string | null;
      collateralId?: string | null;
    },
    existing?: { borrowerId: string | null; collateralId: string | null },
  ) {
    if (data.status === 'ACTIVE' && !(data.borrowerId ?? existing?.borrowerId))
      throw new BadRequestException('Укажите заёмщика');
    if (
      data.status === 'ACTIVE' &&
      !(data.collateralId ?? existing?.collateralId)
    )
      throw new BadRequestException('Укажите залог');
  }

  async create(userId: string, dto: CreateDealDto) {
    await this.validateLinks(userId, dto);
    this.validateStatus(dto);
    return this.prisma.deal.create({
      data: {
        ...dto,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
        status: dto.status as DealStatus | undefined,
        userId,
      },
      include: dealInclude,
    });
  }

  list(userId: string) {
    return this.prisma.deal.findMany({
      where: { userId, deletedAt: null },
      include: dealInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(userId: string, id: string, dto: Partial<CreateDealDto>) {
    return this.access.withDealLock(userId, id, async (tx) => {
      const existing = await tx.deal.findUniqueOrThrow({ where: { id } });
      if (existing.financeTerms !== null) {
        const fields = [
          'principalAmount',
          'preferentialRate',
          'standardRate',
          'moratoriumMonths',
          'termMonths',
          'penaltyRate',
          'increasedPenaltyRate',
          'paymentDay',
        ] as const;
        if (
          fields.some(
            (key) =>
              dto[key] !== undefined &&
              !new Prisma.Decimal(String(dto[key])).equals(
                String(existing[key]),
              ),
          ) ||
          (dto.signedAt !== undefined &&
            dto.signedAt.slice(0, 10) !==
              existing.signedAt?.toISOString().slice(0, 10))
        ) {
          throw new BadRequestException(
            'Финансовые условия уже подтверждены. Используйте PUT /deals/:id/finance/terms',
          );
        }
      }
      await this.validateLinks(userId, dto);
      this.validateStatus(
        { ...dto, status: dto.status ?? existing.status },
        existing,
      );
      return tx.deal.update({
        where: { id },
        data: {
          ...dto,
          signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
          status: dto.status as DealStatus | undefined,
        },
        include: dealInclude,
      });
    });
  }

  async remove(userId: string, id: string) {
    await this.access.one(userId, id);
    return this.prisma.deal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
