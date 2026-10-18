import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillInvoiceItemDto, BillInvoiceCustomerSnapshotDto } from './create-bill-invoice.dto';

export class UpdateBillInvoiceDto {
  @IsString()
  @IsOptional()
  billNumber?: string;

  @IsOptional()
  date?: string | Date;

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
  @IsOptional()
  items?: BillInvoiceItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
