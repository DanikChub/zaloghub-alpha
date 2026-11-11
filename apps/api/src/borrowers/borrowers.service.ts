import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBorrowerDto } from './dto/create-borrower.dto.js';
@Injectable()
export class BorrowersService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) {
    return this.prisma.borrower.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, data: CreateBorrowerDto) {
    return this.prisma.borrower.create({ data: { ...data, userId } });
  }

  async one(userId: string, id: string) {
    const value = await this.prisma.borrower.findFirst({
      where: { id, userId },
    });
    if (!value) throw new NotFoundException('Заёмщик не найден');
    return value;
  }

  async update(userId: string, id: string, data: Partial<CreateBorrowerDto>) {
    await this.one(userId, id);
    return this.prisma.borrower.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    await this.one(userId, id);
    if (await this.prisma.deal.count({ where: { borrowerId: id } }))
      throw new BadRequestException('Заёмщик используется в сделках');
    return this.prisma.borrower.delete({ where: { id } });
  }
}
