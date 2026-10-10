import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  InvoiceType,
  InvoiceStatus,
  IInvoiceItem,
} from '@rice-mill-project/shared-types';

export class InvoiceItemDto implements IInvoiceItem {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  hsnCode!: string;

  @IsString()
  @IsOptional()
  uom?: string;

  @IsNumber()
  @IsNotEmpty()
  qty!: number;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  @IsNumber()
  @IsNotEmpty()
  rate!: number;

  @IsNumber()
  @IsOptional()
  amount!: number;
}

export class CreateInvoiceDto {
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsEnum(InvoiceType)
  @IsNotEmpty()
  invoiceType!: InvoiceType;

  @IsDateString()
  @IsNotEmpty()
  invoiceDate!: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  vehicleNumber?: string;

  @IsString()
  @IsOptional()
  transportDetails?: string;

  @IsString()
  @IsOptional()
  lrNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  @IsNumber()
  @IsOptional()
  transportCharges?: number;

  @IsNumber()
  @IsOptional()
  hamaliCharges?: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsBoolean()
  @IsOptional()
  isInterState?: boolean;

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
