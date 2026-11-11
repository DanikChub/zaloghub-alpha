import { IsUUID } from 'class-validator';
import { CreateOperationDto } from './cash-operation.dto.js';
export class CreditPreviewDto extends CreateOperationDto {
  @IsUUID() receiptId!: string;
}
