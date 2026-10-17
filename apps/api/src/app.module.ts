import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DealsModule } from './deals/deals.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, UsersModule, AuthModule, DealsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
