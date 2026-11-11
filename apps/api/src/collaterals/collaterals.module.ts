import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CollateralsController } from './collaterals.controller.js';
import { CollateralsService } from './collaterals.service.js';
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [CollateralsController],
  providers: [CollateralsService],
  exports: [CollateralsService],
})
export class CollateralsModule {}
