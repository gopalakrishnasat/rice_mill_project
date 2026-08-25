import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerAddressDto } from './create-customer.dto';

export class UpdateCustomerDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  contactPerson?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsString()
  @IsOptional()
  pan?: string;

  @ValidateNested()
  @Type(() => CustomerAddressDto)
  @IsOptional()
  billingAddress?: CustomerAddressDto;

  @ValidateNested()
  @Type(() => CustomerAddressDto)
  @IsOptional()
  shippingAddress?: CustomerAddressDto;

  @IsNumber()
  @IsOptional()
  creditLimit?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
