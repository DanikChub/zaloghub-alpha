
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import { UsersModule } from './users/users.module.js';

@Controller()
export class AppController {
  constructor(
      private readonly prisma: PrismaService,
  ) {}

  @Get('health/db')
  async checkDatabase() {
    const usersCount = await this.prisma.user.count();

    return {
      status: 'ok',
      database: 'connected',
      usersCount,
    };
  }
}
