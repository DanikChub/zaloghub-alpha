
import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Get,
    Req,
    UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
    JwtAuthGuard,
    type AuthenticatedRequest,
} from './guards/jwt-auth.guard.js';
import { UsersService } from '../users/users.service.js';
import { UnauthorizedException } from '@nestjs/common';
import {VerifyCodeDto} from "./dto/verify-code.dto.js";

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
    ) {}

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }


    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async me(@Req() request: AuthenticatedRequest) {
        const user = await this.usersService.findById(
            request.user.id,
        );

        if (!user || !user.isActive) {
            throw new UnauthorizedException();
        }

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: user.createdAt,
        };
    }

    @Post('verify')
    @HttpCode(HttpStatus.OK)
    verify(@Body() dto: VerifyCodeDto) {
        return this.authService.verify(
            dto.challengeId,
            dto.code,
        );
    }

}
