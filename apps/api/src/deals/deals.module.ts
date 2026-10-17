import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DealsController } from './deals.controller.js';
import { DealsService } from './deals.service.js';

@Module({
  imports: [JwtModule.registerAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET') }) })],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
