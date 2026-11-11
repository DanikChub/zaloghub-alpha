import { IsObject, IsString, Matches } from 'class-validator';
import type { LoanTerms } from '../core/loan/loan.types.js';
export class FinanceTermsDto {
  @IsObject() terms!: LoanTerms;
  @IsString() @Matches(/^[a-f0-9]{64}$/) confirmationHash!: string;
}

export class FinanceTermsPreviewDto {
  @IsObject() terms!: LoanTerms;
}
