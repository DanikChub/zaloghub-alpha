import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export enum DealStatusDto { DRAFT = 'DRAFT', ACTIVE = 'ACTIVE', CLOSED = 'CLOSED' }
export enum PaymentTypeDto { INTEREST = 'INTEREST', PRINCIPAL = 'PRINCIPAL', PENALTY = 'PENALTY', OTHER = 'OTHER' }

export class CreateBorrowerDto {
  @IsString() @MaxLength(100) firstName!: string;
  @IsString() @MaxLength(100) lastName!: string;
  @IsOptional() @IsString() @MaxLength(100) middleName?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
}

export class CreateCollateralDto {
  @IsString() @MaxLength(60) type!: string;
  @IsString() @MaxLength(500) address!: string;
  @IsOptional() @IsString() @MaxLength(100) cadastralNumber?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) estimatedValue?: number;
}

export class CreateDealDto {
  @IsOptional() @IsUUID() borrowerId?: string;
  @IsOptional() @IsUUID() collateralId?: string;
  @IsOptional() @IsString() @MaxLength(100) contractNumber?: string;
  @IsOptional() @IsDateString() signedAt?: string;
  @IsOptional() @IsString() @MaxLength(200) contractCity?: string;
  @Type(() => Number) @IsNumber() @Min(0) principalAmount!: number;
  @Type(() => Number) @IsNumber() @Min(0) preferentialRate!: number;
  @Type(() => Number) @IsNumber() @Min(0) standardRate!: number;
  @Type(() => Number) @IsInt() @Min(0) moratoriumMonths!: number;
  @Type(() => Number) @IsInt() @Min(1) termMonths!: number;
  @Type(() => Number) @IsNumber() @Min(0) penaltyRate!: number;
  @Type(() => Number) @IsNumber() @Min(0) increasedPenaltyRate!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(31) paymentDay!: number;
  @IsOptional() @IsEnum(DealStatusDto) status?: DealStatusDto;
}

export class CreateOperationDto {
  @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;
  @IsDateString() date!: string;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class CreatePaymentDto extends CreateOperationDto {
  @IsEnum(PaymentTypeDto) type!: PaymentTypeDto;
}
