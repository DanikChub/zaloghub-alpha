import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../../auth/guards/jwt-auth.guard.js';
import { validation } from '../../common/validation-pipes.js';
import { PortfolioFinanceService } from '../application/portfolio-finance.service.js';


@Controller()
@UseGuards(JwtAuthGuard)
export class PortfolioFinanceController {

  constructor(private readonly service: PortfolioFinanceService) {}

  @Get('deals/summary')
  summary(
    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.service.summary(req.user.id);
  }
}
