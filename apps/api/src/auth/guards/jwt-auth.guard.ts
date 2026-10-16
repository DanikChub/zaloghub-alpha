
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

interface JwtPayload {
    sub: string;
}

export interface AuthenticatedRequest extends Request {
    user: {
        id: string;
    };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
    ) {}

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();

        const authorization = request.headers.authorization;

        const [type, token] = authorization?.split(' ') ?? [];

        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException();
        }

        try {
            const payload =
                await this.jwtService.verifyAsync<JwtPayload>(token);

            if (
                typeof payload.sub !== 'string' ||
                !payload.sub
            ) {
                throw new UnauthorizedException();
            }

            request.user = {
                id: payload.sub,
            };

            return true;
        } catch {
            throw new UnauthorizedException(
                'Недействительный или истёкший токен',
            );
        }
    }
}
