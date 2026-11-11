import { expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AuthChallengeService } from './auth-challenge.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmailService } from './email.service.js';

it('removes only the undelivered challenge so a failed SMTP request does not impose a resend cooldown', async () => {
  const db = { authChallenge: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id:'new-challenge' }),
    deleteMany: vi.fn().mockResolvedValue({ count:1 }),
  } };
  const failure = new ServiceUnavailableException('Delivery unavailable');
  const email = { sendAuthCode: vi.fn().mockRejectedValue(failure) };
  const service = new AuthChallengeService(db as unknown as PrismaService, email as unknown as EmailService, new ConfigService({ AUTH_CODE_SECRET:'test-only' }));
  await expect(service.issue('user-1','recipient@example.test')).rejects.toBe(failure);
  expect(db.authChallenge.deleteMany).toHaveBeenCalledWith({ where:{ id:'new-challenge' } });
  expect(db.authChallenge.create.mock.calls[0][0].data.codeHash).toMatch(/^[a-f0-9]{64}$/);
});
