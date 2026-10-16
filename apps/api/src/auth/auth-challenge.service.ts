
import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    createHmac,
    randomInt, randomUUID,
    timingSafeEqual,
} from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from './email.service.js';

@Injectable()
export class AuthChallengeService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly email: EmailService,
        private readonly config: ConfigService,
    ) {}

    private hash(challengeId: string, code: string) {
        return createHmac(
            'sha256',
            this.config.getOrThrow<string>('AUTH_CODE_SECRET'),
        )
            .update(`${challengeId}:${code}`)
            .digest('hex');
    }

    async issue(userId: string, email: string) {
        const last = await this.prisma.authChallenge.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        if (
            last &&
            Date.now() - last.createdAt.getTime() < 60_000
        ) {
            throw new HttpException(
                'Повторите запрос через минуту',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        const code = randomInt(0, 1_000_000)
            .toString()
            .padStart(6, '0');

        const challengeId = randomUUID();

        const challenge = await this.prisma.authChallenge.create({
            data: {
                id: challengeId,
                userId,
                codeHash: this.hash(challengeId, code),
                expiresAt: new Date(Date.now() + 10 * 60_000),
            },
        });

        await this.email.sendAuthCode(email, code);

        return {
            challengeId: challenge.id,
            expiresIn: 600,
        };
    }

    async verify(challengeId: string, code: string) {
        if (!/^\d{6}$/.test(code)) {
            throw new BadRequestException('Неверный код');
        }

        const challenge =
            await this.prisma.authChallenge.findUnique({
                where: { id: challengeId },
                include: { user: true },
            });

        if (
            !challenge ||
            challenge.consumedAt ||
            challenge.expiresAt.getTime() < Date.now() ||
            challenge.attempts >= 5 ||
            !challenge.user.isActive
        ) {
            throw new BadRequestException(
                'Код недействителен или истёк',
            );
        }

        const expected = Buffer.from(challenge.codeHash, 'hex');
        const actual = Buffer.from(
            this.hash(challenge.id, code),
            'hex',
        );

        const valid = timingSafeEqual(expected, actual);

        // Атомарно учитываем попытку и блокируем повторное
        // использование одного challenge при одновременных запросах.
        const claimed = await this.prisma.authChallenge.updateMany({
            where: {
                id: challenge.id,
                consumedAt: null,
                expiresAt: { gt: new Date() },
                attempts: { lt: 5 },
            },
            data: {
                attempts: { increment: 1 },
                ...(valid ? { consumedAt: new Date() } : {}),
            },
        });

        if (claimed.count !== 1 || !valid) {
            throw new BadRequestException('Неверный код');
        }

        await this.prisma.user.update({
            where: { id: challenge.userId },
            data: { emailVerifiedAt: new Date() },
        });

        return challenge.user;
    }
}
