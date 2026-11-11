import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DealsController } from './deals.controller.js';
import { DealsService } from './deals.service.js';
import { DealAccessModule } from './deal-access.module.js';
import { BorrowersModule } from '../borrowers/borrowers.module.js';
import { CollateralsModule } from '../collaterals/collaterals.module.js';
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    DealAccessModule,
    BorrowersModule,
    CollateralsModule,
  ],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
