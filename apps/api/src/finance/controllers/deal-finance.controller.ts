import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../../auth/guards/jwt-auth.guard.js';
import { validation } from '../../common/validation-pipes.js';
import { DealFinanceService } from '../application/deal-finance.service.js';
import { FinanceTermsService } from '../application/finance-terms.service.js';
import { FinanceQueryDto } from '../dto/finance-query.dto.js';
import {
  FinanceTermsDto,
  FinanceTermsPreviewDto,
} from '../dto/finance-terms.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class DealFinanceController {
  constructor(
    private readonly service: DealFinanceService,
    private readonly terms: FinanceTermsService,
  ) {}

  @Get('deals/:id/finance')
  finance(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
    @Query(validation)
    query: FinanceQueryDto,
  ) {
    return this.service.finance(req.user.id, id, query.asOfOn);
  }

  @Get('deals/:id/finance/terms')
  financeTerms(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
  ) {
    return this.terms.financeTerms(req.user.id, id);
  }

  @Post('deals/:id/finance/terms/preview')
  preview(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(validation) dto: FinanceTermsPreviewDto,
  ) {
    return this.terms.preview(req.user.id, id, dto.terms);
  }

  @Post('deals/:id/finance/terms/calendar/extend')
  extendCalendar(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(validation) dto: FinanceQueryDto,
  ) {
    return this.terms.extendCalendar(req.user.id, id, dto.asOfOn);
  }

  @Put('deals/:id/finance/terms')
  setFinanceTerms(
    @Req()
    req: AuthenticatedRequest,
    @Param('id')
    id: string,
    @Body(validation)
    dto: FinanceTermsDto,
  ) {
    return this.terms.setFinanceTerms(
      req.user.id,
      id,
      dto.terms,
      dto.confirmationHash,
    );
  }
}
