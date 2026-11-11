import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BorrowersController } from './borrowers.controller.js';
import { BorrowersService } from './borrowers.service.js';
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [BorrowersController],
  providers: [BorrowersService],
  exports: [BorrowersService],
})
export class BorrowersModule {}
