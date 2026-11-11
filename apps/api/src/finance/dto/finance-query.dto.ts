import { IsOptional, IsDateString, Matches } from 'class-validator';
export class FinanceQueryDto {
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  asOfOn?: string;
}
