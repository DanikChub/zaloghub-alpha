import { VerificationDatabaseFilter } from './verification-database.filter.js';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  BorrowerVerificationsController,
  VerificationIdentityController,
  VerificationItemsController,
  VerificationFindingsController,
  VerificationRisksController,
  VerificationEvidenceController,
} from './borrower-verifications.controllers.js';
import { BorrowerVerificationsService } from './borrower-verifications.service.js';
import { VerificationAccessService } from './verification-access.service.js';
import { VerificationIdentityService } from './verification-identity.service.js';
import { VerificationEvidenceService } from './verification-evidence.service.js';
import { VerificationRiskService } from './verification-risk.service.js';
import { BorrowerCheckRunsService } from './borrower-check-runs.service.js';
import { DocumentStorageService } from './document-storage.service.js';
import { VerificationAdaptersRegistry } from './verification-adapters.registry.js';
import { BorrowerChecksWorker } from './borrower-checks.worker.js';
import { VerificationSerializationInterceptor } from './verification-serialization.interceptor.js';
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [
    BorrowerVerificationsController,
    VerificationIdentityController,
    VerificationItemsController,
    VerificationFindingsController,
    VerificationRisksController,
    VerificationEvidenceController,
  ],
  providers: [
    VerificationDatabaseFilter,
    BorrowerVerificationsService,
    VerificationAccessService,
    VerificationIdentityService,
    VerificationEvidenceService,
    VerificationRiskService,
    BorrowerCheckRunsService,
    DocumentStorageService,
    VerificationAdaptersRegistry,
    BorrowerChecksWorker,
    VerificationSerializationInterceptor,
  ],
})
export class BorrowerVerificationsModule {}
