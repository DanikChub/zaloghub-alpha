import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
@Injectable()
export class CollectorGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const expected = this.config.get<string>('MARKETPLACE_COLLECTOR_TOKEN');
    const actual = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, unknown> }>().headers[
      'x-collector-token'
    ];
    if (
      !expected ||
      expected.length < 32 ||
      typeof actual !== 'string' ||
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      throw new UnauthorizedException();
    return true;
  }
}
