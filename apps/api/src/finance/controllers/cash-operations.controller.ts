import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../../auth/guards/jwt-auth.guard.js';
import { validation } from '../../common/validation-pipes.js';
import { CashOperationsService } from '../application/cash-operations.service.js';
import { DealAccessService } from '../../deals/deal-access.service.js';
import {
  CreateOperationDto,
  CreatePaymentDto,
} from '../dto/cash-operation.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class CashOperationsController {
  constructor(
    private readonly service: CashOperationsService,
    private readonly access: DealAccessService,
  ) {}

  @Get('deals/:id/disbursements')
  disbursements(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
  ) {
    return this.access.one(req.user.id, id).then((d) => d.disbursements);
  }

  @Post('deals/:id/disbursements')
  disburse(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
    @Body(validation)
    dto: CreateOperationDto,
  ) {
    return this.service.disburse(req.user.id, id, dto);
  }

  @Delete('deals/:id/disbursements/:operationId')
  deleteDisbursement(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('operationId') operationId: string,
  ) {
    return this.service.deleteDisbursement(req.user.id, id, operationId);
  }

  @Get('deals/:id/payments')
  payments(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
  ) {
    return this.access.one(req.user.id, id).then((d) => d.payments);
  }

  @Post('deals/:id/payments')
  pay(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
    @Body(validation)
    dto: CreatePaymentDto,
  ) {
    return this.service.pay(req.user.id, id, dto);
  }

  @Delete('deals/:id/payments/:operationId')
  deletePayment(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('operationId') operationId: string,
  ) {
    return this.service.deletePayment(req.user.id, id, operationId);
  }
}
