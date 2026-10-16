
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('UsersService', () => {
    let service: UsersService;

    const prismaMock = {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();

        service = new UsersService(
            prismaMock as unknown as PrismaService,
        );
    });

    describe('findByEmail', () => {
        it('should find a user by email', async () => {
            const user = {
                id: 'user-123',
                email: 'test@example.com',
                passwordHash: 'hashed-password',
            };

            prismaMock.user.findUnique.mockResolvedValue(user);

            const result = await service.findByEmail(
                'test@example.com',
            );

            expect(result).toEqual(user);

            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
                where: {
                    email: 'test@example.com',
                },
            });
        });

        it('should return null when user does not exist', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);

            const result = await service.findByEmail(
                'unknown@example.com',
            );

            expect(result).toBeNull();
        });
    });
});
