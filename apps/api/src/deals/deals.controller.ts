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
import { DealsService } from './deals.service.js';
import { DealAccessService } from './deal-access.service.js';
import { CreateDealDto } from './dto/create-deal.dto.js';



@Controller()
@UseGuards(JwtAuthGuard)
export class DealsController {

  constructor(
    private readonly service: DealsService,
    private readonly access: DealAccessService,
  ) {}

  @Get('deals')
  list(
    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.service.list(req.user.id);
  }

  @Post('deals')
  create(
    @Req()
    req: AuthenticatedRequest,
    @Body(validation)
    dto: CreateDealDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  @Get('deals/:id')
  one(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
  ) {
    return this.access.one(req.user.id, id);
  }

  @Patch('deals/:id')
  update(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
    @Body(partialValidation)
    dto: CreateDealDto,
  ) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete('deals/:id')
  remove(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
  ) {
    return this.service.remove(req.user.id, id);
  }
}
