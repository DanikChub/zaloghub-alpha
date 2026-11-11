import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { EmailService } from './email.service.js';

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));
describe('Production email delivery', () => {
  const transport = { set: vi.fn(), sendMail: vi.fn() };
  const settings = { NODE_ENV:'production', SMTP_HOST:'smtp.example.test', SMTP_PORT:'465', SMTP_USER:'sender@example.test', SMTP_PASSWORD:'test-only', SMTP_FROM:'sender@example.test' };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodemailer.createTransport).mockReturnValue(transport as never);
  });
  it('bounds SMTP waits and keeps TLS enabled', () => {
    new EmailService(new ConfigService(settings));
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      secure:true, connectionTimeout:10000, greetingTimeout:10000, socketTimeout:15000,
    }));
  });
  it('reports a useful 503 without leaking SMTP diagnostics', async () => {
    transport.sendMail.mockRejectedValue(new Error('private SMTP diagnostics'));
    const service = new EmailService(new ConfigService(settings));
    await expect(service.sendAuthCode('recipient@example.test','123456')).rejects.toThrow(ServiceUnavailableException);
    await expect(service.sendAuthCode('recipient@example.test','123456')).rejects.not.toThrow('private SMTP diagnostics');
  });
});
