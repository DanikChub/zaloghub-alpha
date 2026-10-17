import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBorrowerDto, CreateCollateralDto, CreateDealDto, CreateOperationDto, CreatePaymentDto } from './dto.js';
import { Prisma } from '../generated/prisma/client.js';

const dealInclude = { borrower: true, collateral: true, disbursements: { orderBy: { issuedAt: 'desc' as const } }, payments: { orderBy: { paidAt: 'desc' as const } } };

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  borrowers(userId: string) { return this.prisma.borrower.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
  collaterals(userId: string) { return this.prisma.collateral.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
  createBorrower(userId: string, data: CreateBorrowerDto) { return this.prisma.borrower.create({ data: { ...data, userId } }); }
  createCollateral(userId: string, data: CreateCollateralDto) { return this.prisma.collateral.create({ data: { ...data, userId } }); }

  async borrower(userId: string, id: string) {
    const value = await this.prisma.borrower.findFirst({ where: { id, userId } });
    if (!value) throw new NotFoundException('Заёмщик не найден');
    return value;
  }
  async collateral(userId: string, id: string) {
    const value = await this.prisma.collateral.findFirst({ where: { id, userId } });
    if (!value) throw new NotFoundException('Залог не найден');
    return value;
  }
  async updateBorrower(userId: string, id: string, data: Partial<CreateBorrowerDto>) {
    await this.borrower(userId, id);
    return this.prisma.borrower.update({ where: { id }, data });
  }
  async updateCollateral(userId: string, id: string, data: Partial<CreateCollateralDto>) {
    await this.collateral(userId, id);
    return this.prisma.collateral.update({ where: { id }, data });
  }
  async deleteBorrower(userId: string, id: string) {
    await this.borrower(userId, id);
    if (await this.prisma.deal.count({ where: { borrowerId: id } })) throw new BadRequestException('Заёмщик используется в сделках');
    return this.prisma.borrower.delete({ where: { id } });
  }
  async deleteCollateral(userId: string, id: string) {
    await this.collateral(userId, id);
    if (await this.prisma.deal.count({ where: { collateralId: id } })) throw new BadRequestException('Залог используется в сделках');
    return this.prisma.collateral.delete({ where: { id } });
  }

  async validateLinks(userId: string, data: { borrowerId?: string | null; collateralId?: string | null }) {
    if (data.borrowerId) await this.borrower(userId, data.borrowerId);
    if (data.collateralId) await this.collateral(userId, data.collateralId);
  }
  validateStatus(data: { status?: string; borrowerId?: string | null; collateralId?: string | null }, existing?: { borrowerId: string | null; collateralId: string | null }) {
    if (data.status === 'ACTIVE' && !(data.borrowerId ?? existing?.borrowerId) ) throw new BadRequestException('Укажите заёмщика');
    if (data.status === 'ACTIVE' && !(data.collateralId ?? existing?.collateralId)) throw new BadRequestException('Укажите залог');
  }
  async create(userId: string, dto: CreateDealDto) {
    await this.validateLinks(userId, dto);
    this.validateStatus(dto);
    return this.prisma.deal.create({ data: { ...dto, signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined, userId }, include: dealInclude });
  }
  list(userId: string) {
    return this.prisma.deal.findMany({ where: { userId, deletedAt: null }, include: { borrower: true, collateral: true, disbursements: true, payments: true }, orderBy: { createdAt: 'desc' } });
  }
  async one(userId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id, userId, deletedAt: null }, include: dealInclude });
    if (!deal) throw new NotFoundException('Сделка не найдена');
    return deal;
  }
  async update(userId: string, id: string, dto: Partial<CreateDealDto>) {
    const existing = await this.one(userId, id);
    await this.validateLinks(userId, dto);
    this.validateStatus({ ...dto, status: dto.status ?? existing.status }, existing);
    return this.prisma.deal.update({ where: { id }, data: { ...dto, signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined }, include: dealInclude });
  }
  async remove(userId: string, id: string) {
    await this.one(userId, id);
    return this.prisma.deal.update({ where: { id }, data: { deletedAt: new Date() } });
  }
  async disburse(userId: string, id: string, dto: CreateOperationDto) {
    await this.one(userId, id);
    return this.prisma.disbursement.create({ data: { dealId: id, amount: dto.amount, issuedAt: new Date(dto.date), comment: dto.comment } });
  }
  async pay(userId: string, id: string, dto: CreatePaymentDto) {
    await this.one(userId, id);
    return this.prisma.payment.create({ data: { dealId: id, amount: dto.amount, paidAt: new Date(dto.date), type: dto.type, comment: dto.comment } });
  }
  async deleteDisbursement(userId: string, id: string, operationId: string) {
    await this.one(userId, id);
    const result = await this.prisma.disbursement.deleteMany({ where: { id: operationId, dealId: id } });
    if (!result.count) throw new NotFoundException('Выдача не найдена');
    return { success: true };
  }
  async deletePayment(userId: string, id: string, operationId: string) {
    await this.one(userId, id);
    const result = await this.prisma.payment.deleteMany({ where: { id: operationId, dealId: id } });
    if (!result.count) throw new NotFoundException('Платёж не найден');
    return { success: true };
  }
  async summary(userId: string) {
    const deals = await this.list(userId);
    let issued = new Prisma.Decimal(0), principalReturned = new Prisma.Decimal(0), interestReceived = new Prisma.Decimal(0), penaltiesReceived = new Prisma.Decimal(0);
    for (const deal of deals) {
      for (const item of deal.disbursements) issued = issued.plus(item.amount);
      for (const item of deal.payments) {
        if (item.type === 'PRINCIPAL') principalReturned = principalReturned.plus(item.amount);
        if (item.type === 'INTEREST') interestReceived = interestReceived.plus(item.amount);
        if (item.type === 'PENALTY') penaltiesReceived = penaltiesReceived.plus(item.amount);
      }
    }
    return { dealCount: deals.length, issued: issued.toString(), principalReturned: principalReturned.toString(), outstandingCapital: issued.minus(principalReturned).toString(), interestReceived: interestReceived.toString(), penaltiesReceived: penaltiesReceived.toString() };
  }
}
