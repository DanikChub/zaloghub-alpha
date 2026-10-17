import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { DealsService } from './deals.service.js';
import { CreateBorrowerDto, CreateCollateralDto, CreateDealDto, CreateOperationDto, CreatePaymentDto } from './dto.js';

const validation = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

@Controller()
@UseGuards(JwtAuthGuard)
export class DealsController {
  constructor(private readonly service: DealsService) {}
  @Get('borrowers') borrowers(@Req() req: AuthenticatedRequest) { return this.service.borrowers(req.user.id); }
  @Post('borrowers') createBorrower(@Req() req: AuthenticatedRequest, @Body(validation) dto: CreateBorrowerDto) { return this.service.createBorrower(req.user.id, dto); }
  @Get('borrowers/:id') borrower(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.borrower(req.user.id, id); }
  @Patch('borrowers/:id') updateBorrower(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body(validation) dto: CreateBorrowerDto) { return this.service.updateBorrower(req.user.id, id, dto); }
  @Delete('borrowers/:id') deleteBorrower(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.deleteBorrower(req.user.id, id); }
  @Get('collaterals') collaterals(@Req() req: AuthenticatedRequest) { return this.service.collaterals(req.user.id); }
  @Post('collaterals') createCollateral(@Req() req: AuthenticatedRequest, @Body(validation) dto: CreateCollateralDto) { return this.service.createCollateral(req.user.id, dto); }
  @Get('collaterals/:id') collateral(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.collateral(req.user.id, id); }
  @Patch('collaterals/:id') updateCollateral(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body(validation) dto: CreateCollateralDto) { return this.service.updateCollateral(req.user.id, id, dto); }
  @Delete('collaterals/:id') deleteCollateral(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.deleteCollateral(req.user.id, id); }
  @Get('deals/summary') summary(@Req() req: AuthenticatedRequest) { return this.service.summary(req.user.id); }
  @Get('deals') list(@Req() req: AuthenticatedRequest) { return this.service.list(req.user.id); }
  @Post('deals') create(@Req() req: AuthenticatedRequest, @Body(validation) dto: CreateDealDto) { return this.service.create(req.user.id, dto); }
  @Get('deals/:id') one(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.one(req.user.id, id); }
  @Patch('deals/:id') update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body(validation) dto: CreateDealDto) { return this.service.update(req.user.id, id, dto); }
  @Delete('deals/:id') remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.remove(req.user.id, id); }
  @Get('deals/:id/disbursements') disbursements(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.one(req.user.id, id).then(d => d.disbursements); }
  @Post('deals/:id/disbursements') disburse(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body(validation) dto: CreateOperationDto) { return this.service.disburse(req.user.id, id, dto); }
  @Delete('deals/:id/disbursements/:operationId') deleteDisbursement(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('operationId') operationId: string) { return this.service.deleteDisbursement(req.user.id, id, operationId); }
  @Get('deals/:id/payments') payments(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.one(req.user.id, id).then(d => d.payments); }
  @Post('deals/:id/payments') pay(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body(validation) dto: CreatePaymentDto) { return this.service.pay(req.user.id, id, dto); }
  @Delete('deals/:id/payments/:operationId') deletePayment(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('operationId') operationId: string) { return this.service.deletePayment(req.user.id, id, operationId); }
}
