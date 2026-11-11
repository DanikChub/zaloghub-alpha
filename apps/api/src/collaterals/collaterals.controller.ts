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
import { CollateralsService } from './collaterals.service.js';
import { CreateCollateralDto } from './dto/create-collateral.dto.js';


@Controller()
@UseGuards(JwtAuthGuard)
export class CollateralsController {

  constructor(private readonly service: CollateralsService) {}

  @Get('collaterals')
  collaterals(
    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.service.list(req.user.id);
  }

  @Post('collaterals')
  createCollateral(
    @Req()
    req: AuthenticatedRequest,
    @Body(validation)
    dto: CreateCollateralDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  @Get('collaterals/:id')
  collateral(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
  ) {
    return this.service.one(req.user.id, id);
  }

  @Patch('collaterals/:id')
  updateCollateral(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
    @Body(partialValidation)
    dto: CreateCollateralDto,
  ) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete('collaterals/:id')
  deleteCollateral(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
  ) {
    return this.service.remove(req.user.id, id);
  }
}
