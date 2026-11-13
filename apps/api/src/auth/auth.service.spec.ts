
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {ConflictException, UnauthorizedException} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import * as argon2 from 'argon2';

import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { AuthChallengeService } from './auth-challenge.service.js';

describe('AuthService', () => {
    let service: AuthService;

    const usersMock = {
        findByEmail: vi.fn(),
        create: vi.fn(),
    };

    const jwtMock = {
        signAsync: vi.fn(),
        verifyAsync: vi.fn(),
    };
    const challenge = { challengeId: 'challenge-123', email: 'test@example.com' };
    const challengesMock = { issue: vi.fn(), verify: vi.fn() };

    const registerDto = {
        email: 'Test@Example.com',
        password: 'VeryStrongPassword123!',
        firstName: 'Test',
    };

    beforeEach(() => {
        vi.resetAllMocks();
        challengesMock.issue.mockResolvedValue(challenge);

        service = new AuthService(
            usersMock as unknown as UsersService,
            jwtMock as unknown as JwtService,
            challengesMock as unknown as AuthChallengeService,
        );
    });

    it('should register a new user', async () => {
        usersMock.findByEmail.mockResolvedValue(null);

        usersMock.create.mockImplementation(async (data) => ({
            id: 'user-123',
            ...data,
            lastName: null,
            createdAt: new Date('2026-10-16T12:00:00Z'),
        }));

        const result = await service.register(registerDto);

        expect(usersMock.findByEmail).toHaveBeenCalledWith(
            'test@example.com',
        );

        expect(usersMock.create).toHaveBeenCalledOnce();

        expect(challengesMock.issue).toHaveBeenCalledWith('user-123', 'test@example.com');
        expect(jwtMock.signAsync).not.toHaveBeenCalled();
        expect(result).toEqual(challenge);
    });

    it('should reject duplicate emails', async () => {
        usersMock.findByEmail.mockResolvedValue({
            id: 'existing-user',
            email: 'test@example.com',
        });

        await expect(
            service.register(registerDto),
        ).rejects.toThrow(ConflictException);

        expect(usersMock.create).not.toHaveBeenCalled();
    });

    it('should hash the password before saving', async () => {
        usersMock.findByEmail.mockResolvedValue(null);

        usersMock.create.mockImplementation(async (data) => ({
            id: 'user-123',
            ...data,
            createdAt: new Date(),
        }));

        await service.register(registerDto);

        const savedData = usersMock.create.mock.calls[0][0];

        expect(savedData.passwordHash).not.toBe(
            registerDto.password,
        );

        expect(
            await argon2.verify(
                savedData.passwordHash,
                registerDto.password,
            ),
        ).toBe(true);
    });

    it('should never expose passwordHash in response', async () => {
        usersMock.findByEmail.mockResolvedValue(null);

        usersMock.create.mockImplementation(async (data) => ({
            id: 'user-123',
            ...data,
            createdAt: new Date(),
        }));

        const result = await service.register(registerDto);

        expect(result).not.toHaveProperty('passwordHash');
        expect(result).not.toHaveProperty('password');
    });

    it('should handle Prisma unique constraint errors', async () => {
        usersMock.findByEmail.mockResolvedValue(null);

        usersMock.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError(
                'Unique constraint failed',
                {
                    code: 'P2002',
                    clientVersion: '7.10.1',
                },
            ),
        );

        await expect(
            service.register(registerDto),
        ).rejects.toThrow(ConflictException);
    });


    describe('login', () => {
        const password = 'VeryStrongPassword123!';

        const loginDto = {
            email: 'Test@Example.com',
            password,
        };

        it('should require an email challenge before issuing a token', async () => {
            const passwordHash = await argon2.hash(password);

            usersMock.findByEmail.mockResolvedValue({
                id: 'user-123',
                email: 'test@example.com',
                passwordHash,
                isActive: true,
            });

            jwtMock.signAsync.mockResolvedValue('signed-jwt');

            const result = await service.login(loginDto);

            expect(usersMock.findByEmail).toHaveBeenCalledWith(
                'test@example.com',
            );

            expect(challengesMock.issue).toHaveBeenCalledWith('user-123', 'test@example.com');
            expect(jwtMock.signAsync).not.toHaveBeenCalled();
            expect(result).toEqual(challenge);
        });

        it.each(['valid', 'expired', 'wrong-user', 'access-token'])('handles %s device proof', async (kind) => {
            usersMock.findByEmail.mockResolvedValue({
                id: 'user-123', email: 'test@example.com',
                passwordHash: await argon2.hash(password), isActive: true,
            });
            jwtMock.signAsync.mockResolvedValue('new-access');
            if (kind === 'expired') jwtMock.verifyAsync.mockRejectedValue(new Error('expired'));
            else jwtMock.verifyAsync.mockResolvedValue({
                sub: kind === 'wrong-user' ? 'someone-else' : 'user-123',
                purpose: kind === 'access-token' ? undefined : 'trusted-device',
            });
            const result = await service.login({ ...loginDto, trustedDeviceToken: 'proof' });
            if (kind === 'valid') {
                expect(result).toEqual({ accessToken: 'new-access', tokenType: 'Bearer', expiresIn: 604800 });
                expect(challengesMock.issue).not.toHaveBeenCalled();
                expect(jwtMock.signAsync).toHaveBeenCalledTimes(1);
            } else {
                expect(result).toEqual(challenge);
                expect(jwtMock.signAsync).not.toHaveBeenCalled();
            }
        });

        it('should reject an unknown email', async () => {
            usersMock.findByEmail.mockResolvedValue(null);

            await expect(
                service.login(loginDto),
            ).rejects.toThrow(UnauthorizedException);

            expect(jwtMock.signAsync).not.toHaveBeenCalled();
        });

        it('should reject an incorrect password', async () => {
            const passwordHash = await argon2.hash('AnotherPassword123!');

            usersMock.findByEmail.mockResolvedValue({
                id: 'user-123',
                email: 'test@example.com',
                passwordHash,
                isActive: true,
            });

            await expect(
                service.login(loginDto),
            ).rejects.toThrow(UnauthorizedException);

            expect(jwtMock.signAsync).not.toHaveBeenCalled();
        });

        it('should reject an inactive user', async () => {
            usersMock.findByEmail.mockResolvedValue({
                id: 'user-123',
                email: 'test@example.com',
                passwordHash: 'unused',
                isActive: false,
            });

            await expect(
                service.login(loginDto),
            ).rejects.toThrow(UnauthorizedException);

            expect(jwtMock.signAsync).not.toHaveBeenCalled();
        });
    });

    it('issues a token only after successful code verification', async () => {
        challengesMock.verify.mockResolvedValue({ id: 'user-123' });
        jwtMock.signAsync.mockResolvedValue('signed-jwt');
        expect(await service.verify('challenge-123', '123456')).toEqual({
            accessToken: 'signed-jwt', tokenType: 'Bearer', expiresIn: 604800, trustedDeviceToken: 'signed-jwt',
        });
        expect(challengesMock.verify).toHaveBeenCalledWith('challenge-123', '123456');
        expect(jwtMock.signAsync).toHaveBeenCalledWith({ sub: 'user-123' });
    });

    it('never issues a token when code verification fails', async () => {
        challengesMock.verify.mockRejectedValue(new UnauthorizedException());
        await expect(service.verify('challenge-123', 'wrong')).rejects.toThrow(UnauthorizedException);
        expect(jwtMock.signAsync).not.toHaveBeenCalled();
    });

});
