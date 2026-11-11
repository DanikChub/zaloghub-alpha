import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DealAccessModule } from '../deals/deal-access.module.js';
import { DealFinanceService } from './application/deal-finance.service.js';
import { CashOperationsService } from './application/cash-operations.service.js';
import { FinanceTermsService } from './application/finance-terms.service.js';
import { PortfolioFinanceService } from './application/portfolio-finance.service.js';
import { DealFinanceController } from './controllers/deal-finance.controller.js';
import { CashOperationsController } from './controllers/cash-operations.controller.js';
import { PortfolioFinanceController } from './controllers/portfolio-finance.controller.js';
import { RussianCalendarService } from './calendar/russian-calendar.service.js';
import { RussianCalendarController } from './controllers/russian-calendar.controller.js';
import { FinanceInstructionStore } from './application/finance-instruction.store.js';
import { CreditManagementService } from './application/credit-management.service.js';
import { CreditManagementController } from './controllers/credit-management.controller.js';
import { SettlementService } from './application/settlement.service.js';
import { SettlementController } from './controllers/settlement.controller.js';
import { DealFinanceJournalService } from './application/deal-finance-journal.service.js';
import { DealFinanceJournalController } from './controllers/deal-finance-journal.controller.js';
import { FinanceJournalWorker } from './application/finance-journal.worker.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    DealAccessModule,
  ],
  controllers: [
    PortfolioFinanceController,
    DealFinanceController,
    CashOperationsController,
    RussianCalendarController,
    CreditManagementController,
    SettlementController,
    DealFinanceJournalController,
  ],
  providers: [
    DealFinanceService,
    CashOperationsService,
    FinanceTermsService,
    PortfolioFinanceService,
    RussianCalendarService,
    FinanceInstructionStore,
    CreditManagementService,
    SettlementService,
    DealFinanceJournalService,
    FinanceJournalWorker,
  ],
  exports: [
    DealFinanceService,
    CashOperationsService,
    FinanceTermsService,
    PortfolioFinanceService,
  ],
})
export class FinanceModule {}
