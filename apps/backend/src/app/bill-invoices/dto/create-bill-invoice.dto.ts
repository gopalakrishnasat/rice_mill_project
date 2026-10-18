import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IBillInvoiceItem, IBillInvoiceCustomerSnapshot } from '@rice-mill-project/shared-types';

export class BillInvoiceItemDto implements IBillInvoiceItem {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @IsNotEmpty()
  quantity!: number;

  @IsString()
  @IsOptional()
  unit!: string;

  @IsNumber()
  @IsNotEmpty()
  rate!: number;

  @IsNumber()
  @IsOptional()
  amount!: number;
}

export class BillInvoiceCustomerSnapshotDto implements IBillInvoiceCustomerSnapshot {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  billingAddress!: string;

  @IsString()
  @IsOptional()
  mobile?: string;
}

export class CreateBillInvoiceDto {
  @IsString()
  @IsOptional()
  billNumber?: string;

  @IsNotEmpty()
  date!: string | Date;

  @IsString()
  @IsOptional()
  vehicleNumber?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BillInvoiceCustomerSnapshotDto)
  customerSnapshot?: BillInvoiceCustomerSnapshotDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillInvoiceItemDto)
  items!: BillInvoiceItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
