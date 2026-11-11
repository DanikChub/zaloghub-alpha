import { Type } from 'class-transformer';
import {
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
  IsDateString,
  IsNumber,
  Min,
  IsInt,
  Max,
  IsEnum,
} from 'class-validator';
export enum DealStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
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
