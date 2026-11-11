import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCollateralDto } from './dto/create-collateral.dto.js';
@Injectable()
export class CollateralsService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) {
    return this.prisma.collateral.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, data: CreateCollateralDto) {
    return this.prisma.collateral.create({ data: { ...data, userId } });
  }

  async one(userId: string, id: string) {
    const value = await this.prisma.collateral.findFirst({
      where: { id, userId },
    });
    if (!value) throw new NotFoundException('Залог не найден');
    return value;
  }

  async update(userId: string, id: string, data: Partial<CreateCollateralDto>) {
    await this.one(userId, id);
    return this.prisma.collateral.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    await this.one(userId, id);
    if (await this.prisma.deal.count({ where: { collateralId: id } }))
      throw new BadRequestException('Залог используется в сделках');
    return this.prisma.collateral.delete({ where: { id } });
  }
}
