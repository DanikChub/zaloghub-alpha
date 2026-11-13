
import {
    ConflictException,
    Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import * as argon2 from 'argon2';

import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';

import {
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto.js';
import {AuthChallengeService} from "./auth-challenge.service.js";

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly challenges: AuthChallengeService,
    ) {}

    async register(dto: RegisterDto) {
        const email = dto.email.trim().toLowerCase();

        const existingUser =
            await this.usersService.findByEmail(email);

        if (existingUser) {
            throw new ConflictException(
                'Пользователь с таким email уже существует',
            );
        }

        const passwordHash = await argon2.hash(dto.password, {
            type: argon2.argon2id,
        });

        try {
            const user = await this.usersService.create({
                email,
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName,
            });

            return this.challenges.issue(user.id, user.email);
        } catch (error: unknown) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ConflictException(
                    'Пользователь с таким email уже существует',
                );
            }

            throw error;
        }
    }



    async login(dto: LoginDto) {
        const email = dto.email.trim().toLowerCase();

        const user = await this.usersService.findByEmail(email);

        if (!user || !user.isActive) {
            throw new UnauthorizedException(
                'Неверный email или пароль',
            );
        }

        const valid = await argon2.verify(
            user.passwordHash,
            dto.password,
        );

        if (!valid) {
            throw new UnauthorizedException(
                'Неверный email или пароль',
            );
        }

        if (dto.trustedDeviceToken) {
            try {
                const trusted = await this.jwtService.verifyAsync<{ sub: string; purpose: string }>(dto.trustedDeviceToken);
                if (trusted.sub === user.id && trusted.purpose === 'trusted-device') {
                    return this.issueTokens(user.id, false);
                }
            } catch {
                // An expired or invalid device proof falls back to email verification.
            }
        }
        return this.challenges.issue(user.id, user.email);
    }

    private async issueTokens(userId: string, rememberDevice: boolean) {
        const accessToken = await this.jwtService.signAsync({ sub: userId });
        const trustedDeviceToken = rememberDevice
            ? await this.jwtService.signAsync({ sub: userId, purpose: 'trusted-device' }, { expiresIn: '7d' })
            : undefined;
        return { accessToken, tokenType: 'Bearer', expiresIn: 604800, ...(trustedDeviceToken ? { trustedDeviceToken } : {}) };
    }

    async verify(challengeId: string, code: string) {
        const user = await this.challenges.verify(
            challengeId,
            code,
        );

        return this.issueTokens(user.id, true);
    }

}
