
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
    const jwtMock = {
        verifyAsync: vi.fn(),
    };

    let guard: JwtAuthGuard;

    const createContext = (authorization?: string) => {
        const request = {
            headers: {
                authorization,
            },
            user: undefined as { id: string } | undefined,
        };

        const context = {
            switchToHttp: () => ({
                getRequest: () => request,
            }),
        } as unknown as ExecutionContext;

        return { context, request };
    };

    beforeEach(() => {
        vi.resetAllMocks();

        guard = new JwtAuthGuard(
            jwtMock as unknown as JwtService,
        );
    });

    it('should allow a valid JWT', async () => {
        const { context, request } = createContext(
            'Bearer valid-token',
        );

        jwtMock.verifyAsync.mockResolvedValue({
            sub: 'user-123',
        });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(request.user).toEqual({
            id: 'user-123',
        });

        expect(jwtMock.verifyAsync).toHaveBeenCalledWith(
            'valid-token',
        );
    });

    it('should reject a missing token', async () => {
        const { context } = createContext();

        await expect(
            guard.canActivate(context),
        ).rejects.toThrow(UnauthorizedException);

        expect(jwtMock.verifyAsync).not.toHaveBeenCalled();
    });

    it('should reject an invalid token', async () => {
        const { context } = createContext(
            'Bearer invalid-token',
        );

        jwtMock.verifyAsync.mockRejectedValue(
            new Error('Invalid signature'),
        );

        await expect(
            guard.canActivate(context),
        ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an invalid payload', async () => {
        const { context } = createContext(
            'Bearer invalid-payload',
        );

        jwtMock.verifyAsync.mockResolvedValue({
            sub: null,
        });

        await expect(
            guard.canActivate(context),
        ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a non-Bearer authorization header', async () => {
        const { context } = createContext(
            'Basic some-credentials',
        );

        await expect(
            guard.canActivate(context),
        ).rejects.toThrow(UnauthorizedException);
    });
});
