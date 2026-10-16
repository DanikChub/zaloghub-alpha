
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let controller: AppController;

  const prismaMock = {
    user: {
      count: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule =
        await Test.createTestingModule({
          controllers: [AppController],
          providers: [
            {
              provide: PrismaService,
              useValue: prismaMock,
            },
          ],
        }).compile();

    controller = module.get<AppController>(AppController);
  });

  describe('GET /health/db', () => {
    it('should return database health status', async () => {
      prismaMock.user.count.mockResolvedValue(5);

      const result = await controller.checkDatabase();

      expect(result).toEqual({
        status: 'ok',
        database: 'connected',
        usersCount: 5,
      });

      expect(prismaMock.user.count).toHaveBeenCalledOnce();
    });
  });
});
