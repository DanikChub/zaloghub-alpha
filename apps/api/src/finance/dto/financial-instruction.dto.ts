import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateOperationDto } from './cash-operation.dto.js';

export class RefundRequestDto extends CreateOperationDto {
  @IsUUID() receiptId!: string;
  @IsUUID() override idempotencyKey: string = undefined!;
}
export class InstructionDateDto {
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
}
export class RefundConfirmationDto extends InstructionDateDto {
  @IsString() @Matches(/\S/) @MaxLength(500) transferReference!: string;
}
export class CreditTargetDto {
  @IsString() @Matches(/^interest:\d{4}-\d{2}-\d{2}$/) obligationKey!: string;
  @IsString()
  @Matches(/^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,15}(?:\.\d{1,2})?)$/)
  amount!: string;
}
export class CreditAgreementDto extends InstructionDateDto {
  @IsUUID() receiptId!: string;
  @IsUUID() idempotencyKey!: string;
  @IsString() @Matches(/\S/) @MaxLength(1000) agreementReference!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreditTargetDto)
  targets!: CreditTargetDto[];
}
export class SettlementAgreementDto extends InstructionDateDto {
  @IsUUID() idempotencyKey!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) quoteHash!: string;
  @IsString() @Matches(/\S/) @MaxLength(1000) agreementReference!: string;
}
export class CalendarImportDto {
  @IsInt() @Min(2013) year!: number;
  @IsOptional() @IsBoolean() refresh?: boolean;
}
