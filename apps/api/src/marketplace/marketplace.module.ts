import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  MarketplaceController,
  MarketplaceCollectorController,
} from './marketplace.controller.js';
import { MarketplaceService } from './marketplace.service.js';
import { CollectorGuard } from './collector.guard.js';
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [MarketplaceController, MarketplaceCollectorController],
  providers: [MarketplaceService, CollectorGuard],
})
export class MarketplaceModule {}
