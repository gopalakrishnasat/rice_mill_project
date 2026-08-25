import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentMode } from '@rice-mill-project/shared-types';

export class RecordPaymentDto {
  @IsNumber()
  @Min(1)
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
}
