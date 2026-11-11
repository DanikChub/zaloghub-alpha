import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { decimal } from '../core/money.js';
import { dealInclude } from '../../deals/deal-query.js';
import { calculateDealFinance } from '../infrastructure/deal-finance.mapper.js';
@Injectable()
export class PortfolioFinanceService {
  constructor(private readonly prisma: PrismaService) {}
  async summary(userId: string) {
    const deals = await this.prisma.deal.findMany({
      where: { userId, deletedAt: null },
      include: dealInclude,
      orderBy: { createdAt: 'desc' },
    });
    let issued = decimal('0'),
      principalReturned = decimal('0'),
      interestReceived = decimal('0'),
      penaltiesReceived = decimal('0');
    for (const deal of deals) {
      const finance = calculateDealFinance(deal);
      if (finance.status === 'READY') {
        issued = issued.plus(finance.disbursedTotal);
        principalReturned = principalReturned.plus(finance.principalReturned);
        interestReceived = interestReceived.plus(finance.interestPaid);
        penaltiesReceived = penaltiesReceived.plus(finance.penaltyPaid);
        continue;
      }
      for (const item of deal.disbursements)
        issued = issued.plus(item.amount.toString());
      for (const item of deal.payments) {
        if (item.type === 'PRINCIPAL')
          principalReturned = principalReturned.plus(item.amount.toString());
        if (item.type === 'INTEREST')
          interestReceived = interestReceived.plus(item.amount.toString());
        if (item.type === 'PENALTY')
          penaltiesReceived = penaltiesReceived.plus(item.amount.toString());
      }
    }
    return {
      dealCount: deals.length,
      financeConfigurationRequired: deals.filter((d) => d.financeTerms === null)
        .length,
      issued: issued.toString(),
      principalReturned: principalReturned.toString(),
      outstandingCapital: issued.minus(principalReturned).toString(),
      interestReceived: interestReceived.toString(),
      penaltiesReceived: penaltiesReceived.toString(),
    };
  }
}
