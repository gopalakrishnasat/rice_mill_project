import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  IsArray,
  Min,
} from 'class-validator';
import { PaymentMode } from '@rice-mill-project/shared-types';

export class RecordPaymentDto {
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount!: number;

  @IsDateString()
  @IsNotEmpty()
  paymentDate!: string;

  @IsEnum(PaymentMode)
  @IsNotEmpty()
  paymentMode!: PaymentMode;

  @IsString()
  @IsOptional()
  transactionReference?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsArray()
  @IsOptional()
  discounts?: Array<{ invoiceId: string; discount: number }>;
}
