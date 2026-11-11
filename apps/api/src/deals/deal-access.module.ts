import { Module } from '@nestjs/common';
import { DealAccessService } from './deal-access.service.js';
@Module({ providers: [DealAccessService], exports: [DealAccessService] })
export class DealAccessModule {}
