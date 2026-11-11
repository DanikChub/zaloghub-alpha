import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/guards/jwt-auth.guard.js';
import { validation, partialValidation } from '../common/validation-pipes.js';
import { BorrowersService } from './borrowers.service.js';
import { CreateBorrowerDto } from './dto/create-borrower.dto.js';


@Controller()
@UseGuards(JwtAuthGuard)
export class BorrowersController {

  constructor(private readonly service: BorrowersService) {}

  @Get('borrowers')
  borrowers(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.user.id);
  }

  @Post('borrowers')
  createBorrower(
    @Req()
    req: AuthenticatedRequest,
    @Body(validation)
    dto: CreateBorrowerDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  @Get('borrowers/:id')
  borrower(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
  ) {
    return this.service.one(req.user.id, id);
  }

  @Patch('borrowers/:id')
  updateBorrower(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
    @Body(partialValidation)
    dto: CreateBorrowerDto,
  ) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete('borrowers/:id')
  deleteBorrower(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
  ) {
    return this.service.remove(req.user.id, id);
  }
}
