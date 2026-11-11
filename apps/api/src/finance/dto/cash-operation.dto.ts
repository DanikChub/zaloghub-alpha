import { Transform } from 'class-transformer';
import {
  IsString,
  Matches,
  IsDateString,
  IsOptional,
  MaxLength,
  IsUUID,
  IsEnum,
} from 'class-validator';
export enum PaymentTypeDto {
  INTEREST = 'INTEREST',
  PRINCIPAL = 'PRINCIPAL',
  PENALTY = 'PENALTY',
  OTHER = 'OTHER',
}

export class CreateOperationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' &&
    Math.abs(value) <= Number.MAX_SAFE_INTEGER / 100
      ? String(value)
      : value,
  )
  @IsString()
  @Matches(/^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,15}(?:\.\d{1,2})?)$/)
  amount!: string;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
  @IsOptional() @IsUUID() idempotencyKey?: string;
}

export class CreatePaymentDto extends CreateOperationDto {
  /** Совместимость со старым клиентом; расчёт не использует это поле. */
  @IsOptional() @IsEnum(PaymentTypeDto) type?: PaymentTypeDto;
}
