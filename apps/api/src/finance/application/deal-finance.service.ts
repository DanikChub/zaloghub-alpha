import { Injectable } from '@nestjs/common';
import { DealAccessService } from '../../deals/deal-access.service.js';
import { calculateDealFinance } from '../infrastructure/deal-finance.mapper.js';
@Injectable()
export class DealFinanceService {
  constructor(private readonly access: DealAccessService) {}
  async finance(userId: string, id: string, asOfOn?: string) {
    return calculateDealFinance(await this.access.one(userId, id), asOfOn);
  }
}
