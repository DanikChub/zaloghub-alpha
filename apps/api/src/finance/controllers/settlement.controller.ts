import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../../auth/guards/jwt-auth.guard.js';
import { validation } from '../../common/validation-pipes.js';
import { SettlementService } from '../application/settlement.service.js';
import {
  InstructionDateDto,
  SettlementAgreementDto,
} from '../dto/financial-instruction.dto.js';

@Controller('deals/:id/finance/settlements')
@UseGuards(JwtAuthGuard)
export class SettlementController {
  constructor(private readonly service: SettlementService) {}
  @Get('quote') quote(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query(validation) query: InstructionDateDto,
  ) {
    return this.service.quote(req.user.id, id, query.date);
  }
  @Post() agree(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(validation) dto: SettlementAgreementDto,
  ) {
    return this.service.agree(req.user.id, id, dto);
  }
  @Post(':instructionId/execute') execute(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('instructionId') instructionId: string,
    @Body(validation) dto: InstructionDateDto,
  ) {
    return this.service.execute(req.user.id, id, instructionId, dto.date);
  }
  @Post(':instructionId/cancel') cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('instructionId') instructionId: string,
    @Body(validation) dto: InstructionDateDto,
  ) {
    return this.service.cancel(req.user.id, id, instructionId, dto.date);
  }
}
