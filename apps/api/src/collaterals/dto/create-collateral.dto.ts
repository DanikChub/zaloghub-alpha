import { Type } from 'class-transformer';
import {
  IsString,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
export class CreateCollateralDto {
  @IsString() @MaxLength(60) type!: string;
  @IsString() @MaxLength(500) address!: string;
  @IsOptional() @IsString() @MaxLength(100) cadastralNumber?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) estimatedValue?: number;
}
