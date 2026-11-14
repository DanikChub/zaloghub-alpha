import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map } from 'rxjs';
import { jsonSafe } from './verification.validation.js';
@Injectable()
export class VerificationSerializationInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next
      .handle()
      .pipe(
        map((value: unknown) =>
          value === undefined || value instanceof StreamableFile
            ? value
            : jsonSafe(value),
        ),
      );
  }
}
