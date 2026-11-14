import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

// Prisma error messages can embed full queries and passport fields. Never pass them to HTTP or default Nest logging.
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
)
export class VerificationDatabaseFilter implements ExceptionFilter {
  private readonly logger = new Logger(VerificationDatabaseFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const conflict =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003', 'P2004', 'P2010', 'P2025'].includes(error.code);
    const status = conflict ? 409 : 500;
    if (!conflict)
      this.logger.error(
        'Database operation failed in borrower verification; query and personal data omitted',
      );
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        message: conflict
          ? 'Операция не соответствует текущему состоянию проверки или связанным данным'
          : 'Не удалось обработать проверку. Попробуйте позже',
      });
  }
}
