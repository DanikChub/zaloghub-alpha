
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {ConflictException, UnauthorizedException} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import * as argon2 from 'argon2';

import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
    let service: AuthService;

    const usersMock = {
        findByEmail: vi.fn(),
        create: vi.fn(),
    };

    const jwtMock = {
        signAsync: vi.fn(),
    };

    const registerDto = {
        email: 'Test@Example.com',
        password: 'VeryStrongPassword123!',
        firstName: 'Test',
    };

    beforeEach(() => {
        vi.resetAllMocks();

        service = new AuthService(
            usersMock as unknown as UsersService,
            jwtMock as unknown as JwtService,
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

        expect(result).toMatchObject({
            id: 'user-123',
            email: 'test@example.com',
            firstName: 'Test',
        });
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

        it('should return access token for valid credentials', async () => {
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

            expect(jwtMock.signAsync).toHaveBeenCalledWith({
                sub: 'user-123',
            });

            expect(result).toEqual({
                accessToken: 'signed-jwt',
                tokenType: 'Bearer',
                expiresIn: 900,
            });
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

});
