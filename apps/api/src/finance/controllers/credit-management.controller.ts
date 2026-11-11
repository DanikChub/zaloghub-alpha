import {
  Body,
  Controller,
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
import { CreditManagementService } from '../application/credit-management.service.js';
import {
  CreditAgreementDto,
  InstructionDateDto,
  RefundConfirmationDto,
  RefundRequestDto,
} from '../dto/financial-instruction.dto.js';
import { CreditPreviewDto } from '../dto/credit-preview.dto.js';

@Controller('deals/:id/finance/credits')
@UseGuards(JwtAuthGuard)
export class CreditManagementController {
  constructor(private readonly service: CreditManagementService) {}
  @Get() credits(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.credits(req.user.id, id);
  }
  @Post('preview') preview(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(validation) dto: CreditPreviewDto,
  ) {
    return this.service.previewCredit(req.user.id, id, dto);
  }
  @Post('refunds') refund(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(validation) dto: RefundRequestDto,
  ) {
    return this.service.requestRefund(req.user.id, id, dto);
  }
  @Post('refunds/:instructionId/confirm') confirm(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('instructionId') instructionId: string,
    @Body(validation) dto: RefundConfirmationDto,
  ) {
    return this.service.confirmRefund(req.user.id, id, instructionId, dto);
  }
  @Post('refunds/:instructionId/cancel') cancelRefund(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('instructionId') instructionId: string,
    @Body(validation) dto: InstructionDateDto,
  ) {
    return this.service.cancel(
      req.user.id,
      id,
      instructionId,
      'REFUND',
      dto.date,
    );
  }
  @Post('agreements') agreeCredit(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(validation) dto: CreditAgreementDto,
  ) {
    return this.service.agreeCredit(req.user.id, id, dto);
  }
  @Post('agreements/:instructionId/cancel') cancelCredit(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('instructionId') instructionId: string,
    @Body(validation) dto: InstructionDateDto,
  ) {
    return this.service.cancel(
      req.user.id,
      id,
      instructionId,
      'CREDIT',
      dto.date,
    );
  }
}
