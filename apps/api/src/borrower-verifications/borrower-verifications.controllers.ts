import { VerificationDatabaseFilter } from './verification-database.filter.js';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/guards/jwt-auth.guard.js';
import { BorrowerVerificationsService } from './borrower-verifications.service.js';
import { VerificationIdentityService } from './verification-identity.service.js';
import { VerificationEvidenceService } from './verification-evidence.service.js';
import { BorrowerCheckRunsService } from './borrower-check-runs.service.js';
import { VerificationRiskService } from './verification-risk.service.js';
import { VerificationSerializationInterceptor } from './verification-serialization.interceptor.js';
import type { VerificationUpload } from './document-storage.service.js';

@Controller('borrower-verifications')
@UseGuards(JwtAuthGuard)
@UseFilters(VerificationDatabaseFilter)
@UseInterceptors(VerificationSerializationInterceptor)
export class BorrowerVerificationsController {
  constructor(
    @Inject(BorrowerVerificationsService)
    private readonly service: BorrowerVerificationsService,
  ) {}
  @Post('')
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.create(req.user.id, body);
  }
  @Get('')
  list(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string>,
  ) {
    return this.service.list(req.user.id, query);
  }
  @Get(':id')
  getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.getOne(req.user.id, id);
  }
  @Get(':id/readiness')
  readiness(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.readiness(req.user.id, id);
  }
  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.update(req.user.id, id, body);
  }
  @Post(':id/submit-review')
  @HttpCode(200)
  submit(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.submitForReview(req.user.id, id);
  }
  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.complete(req.user.id, id, body);
  }
  @Post(':id/recheck')
  recheck(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.recheck(req.user.id, id);
  }
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.cancel(req.user.id, id);
  }
}

@Controller('borrower-verifications/:id/identity')
@UseGuards(JwtAuthGuard)
@UseFilters(VerificationDatabaseFilter)
@UseInterceptors(VerificationSerializationInterceptor)
export class VerificationIdentityController {
  constructor(
    @Inject(VerificationIdentityService)
    private readonly service: VerificationIdentityService,
  ) {}
  @Get('')
  get(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.get(req.user.id, id);
  }
  @Put('')
  confirm(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.confirm(req.user.id, id, body);
  }
  @Get('history')
  history(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.history(req.user.id, id);
  }
}

@Controller('borrower-verifications/:id')
@UseGuards(JwtAuthGuard)
@UseFilters(VerificationDatabaseFilter)
@UseInterceptors(VerificationSerializationInterceptor)
export class VerificationItemsController {
  constructor(
    @Inject(BorrowerCheckRunsService)
    private readonly service: BorrowerCheckRunsService,
  ) {}
  @Post('run')
  @HttpCode(202)
  bulk(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idem: string | undefined,
  ) {
    return this.service.bulk(req.user.id, id, idem);
  }
  @Get('items')
  items(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.listItems(req.user.id, id);
  }
  @Get('items/:itemId')
  item(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.item(req.user.id, id, itemId);
  }
  @Get('items/:itemId/manual-context')
  context(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.context(req.user.id, id, itemId);
  }
  @Post('items/:itemId/runs')
  @HttpCode(202)
  enqueue(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Headers('idempotency-key') idem: string | undefined,
  ) {
    return this.service.enqueue(req.user.id, id, itemId, idem);
  }
  @Get('items/:itemId/runs')
  history(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.history(req.user.id, id, itemId);
  }
  @Get('items/:itemId/runs/:runId')
  run(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('runId') runId: string,
  ) {
    return this.service.run(req.user.id, id, itemId, runId);
  }
  @Post('items/:itemId/manual-results')
  manual(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idem: string | undefined,
  ) {
    return this.service.manual(req.user.id, id, itemId, body, idem);
  }
  @Post('items/:itemId/runs/:runId/accept')
  @HttpCode(200)
  accept(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('runId') runId: string,
  ) {
    return this.service.accept(req.user.id, id, itemId, runId);
  }
  @Post('items/:itemId/not-applicable')
  @HttpCode(200)
  notApplicable(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
  ) {
    return this.service.notApplicable(req.user.id, id, itemId, body);
  }
}

@Controller('borrower-verifications/:id/items/:itemId/runs/:runId/findings')
@UseGuards(JwtAuthGuard)
@UseFilters(VerificationDatabaseFilter)
@UseInterceptors(VerificationSerializationInterceptor)
export class VerificationFindingsController {
  constructor(
    @Inject(BorrowerCheckRunsService)
    private readonly service: BorrowerCheckRunsService,
  ) {}
  @Get('')
  findings(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('runId') runId: string,
  ) {
    return this.service.findings(req.user.id, id, itemId, runId);
  }
  @Post(':findingId/identity-review')
  @HttpCode(200)
  review(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('runId') runId: string,
    @Param('findingId') findingId: string,
    @Body() body: unknown,
  ) {
    return this.service.reviewFinding(
      req.user.id,
      id,
      itemId,
      runId,
      findingId,
      body,
    );
  }
}

@Controller('borrower-verifications/:id/risks')
@UseGuards(JwtAuthGuard)
@UseFilters(VerificationDatabaseFilter)
@UseInterceptors(VerificationSerializationInterceptor)
export class VerificationRisksController {
  constructor(
    @Inject(VerificationRiskService)
    private readonly service: VerificationRiskService,
  ) {}
  @Get('')
  list(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query() query: Record<string, string>,
  ) {
    return this.service.list(req.user.id, id, query);
  }
  @Post('')
  create(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.create(req.user.id, id, body);
  }
  @Patch(':riskId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
    @Body() body: unknown,
  ) {
    return this.service.change(req.user.id, id, riskId, 'update', body);
  }
  @Post(':riskId/start-remediation')
  @HttpCode(200)
  start(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
  ) {
    return this.service.change(req.user.id, id, riskId, 'start', {});
  }
  @Post(':riskId/resolve')
  @HttpCode(200)
  resolve(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
    @Body() body: unknown,
  ) {
    return this.service.change(req.user.id, id, riskId, 'resolve', body);
  }
  @Post(':riskId/dismiss')
  @HttpCode(200)
  dismiss(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
    @Body() body: unknown,
  ) {
    return this.service.change(req.user.id, id, riskId, 'dismiss', body);
  }
}

@Controller('borrower-verifications/:id/evidence')
@UseGuards(JwtAuthGuard)
@UseFilters(VerificationDatabaseFilter)
@UseInterceptors(VerificationSerializationInterceptor)
export class VerificationEvidenceController {
  constructor(
    @Inject(VerificationEvidenceService)
    private readonly service: VerificationEvidenceService,
  ) {}
  @Get('')
  list(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.list(req.user.id, id);
  }
  @Post('links')
  link(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.addLink(req.user.id, id, body);
  }
  @Get(':evidenceId')
  get(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.service.get(req.user.id, id, evidenceId);
  }
  @Post(':evidenceId/review')
  @HttpCode(200)
  review(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @Body() body: unknown,
  ) {
    return this.service.review(req.user.id, id, evidenceId, body);
  }
  @Post(':evidenceId/recognize')
  @HttpCode(202)
  recognize(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.service.recognize(req.user.id, id, evidenceId);
  }
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
        fields: 12,
        fieldSize: 8192,
      },
    }),
  )
  upload(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @UploadedFile() file: VerificationUpload,
  ) {
    return this.service.upload(req.user.id, id, body, file);
  }
  @Get(':evidenceId/content')
  async download(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const file = await this.service.download(req.user.id, id, evidenceId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, '%27')}`,
    );
    res.send(file.content);
  }
}
