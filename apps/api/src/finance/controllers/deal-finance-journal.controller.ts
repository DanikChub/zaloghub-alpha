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
import { FinanceQueryDto } from '../dto/finance-query.dto.js';
import { DealFinanceJournalService } from '../application/deal-finance-journal.service.js';

@Controller('deals/:id/finance/journal')
@UseGuards(JwtAuthGuard)
export class DealFinanceJournalController {
  constructor(private readonly journal: DealFinanceJournalService) {}

  @Post('versions')
  save(
    @Req() req: AuthenticatedRequest,
    @Param('id') dealId: string,
    @Body(validation) dto: FinanceQueryDto,
  ) {
    return this.journal.save(req.user.id, dealId, dto.asOfOn);
  }

  @Get('versions')
  list(@Req() req: AuthenticatedRequest, @Param('id') dealId: string) {
    return this.journal.list(req.user.id, dealId);
  }

  @Get('versions/:versionId')
  one(
    @Req() req: AuthenticatedRequest,
    @Param('id') dealId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.journal.one(req.user.id, dealId, versionId);
  }
}
