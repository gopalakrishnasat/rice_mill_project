import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ICustomerAddress } from '@rice-mill-project/shared-types';

export class CustomerAddressDto implements ICustomerAddress {
  @IsString()
  @IsNotEmpty()
  line1!: string;

  @IsString()
  @IsOptional()
  line2?: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  stateCode!: string; // e.g. "27" for Maharashtra

  @IsString()
  @IsNotEmpty()
  pincode!: string;
}

export class CreateCustomerDto {
  @IsString()
  @IsOptional()
  customerCode?: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsOptional()
  contactPerson?: string;

  @IsString()
  @IsNotEmpty()
  mobile!: string;

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
  @IsNotEmpty()
  billingAddress!: CustomerAddressDto;

  @ValidateNested()
  @Type(() => CustomerAddressDto)
  @IsOptional()
  shippingAddress?: CustomerAddressDto;

  // @IsNumber()
  // @IsOptional()
  // creditLimit?: number;

  // @IsNumber()
  // @IsOptional()
  // openingBalance?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
