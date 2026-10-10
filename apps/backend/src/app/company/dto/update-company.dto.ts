import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ICompanyAddress,
  ICompanyBankDetails,
  IDevotionalHeaders,
  UpdateCompanyDetailsDto as IUpdateCompanyDetailsDto,
} from '@rice-mill-project/shared-types';

export class CompanyAddressDto implements ICompanyAddress {
  @IsString()
  @IsOptional()
  street!: string;

  @IsString()
  @IsOptional()
  taluka?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  state!: string;

  @IsString()
  @IsOptional()
  pincode!: string;
}

export class CompanyBankDetailsDto implements ICompanyBankDetails {
  @IsString()
  @IsOptional()
  bankName!: string;

  @IsString()
  @IsOptional()
  accountNumber!: string;

  @IsString()
  @IsOptional()
  ifsc!: string;

  @IsString()
  @IsOptional()
  branch!: string;

  @IsString()
  @IsOptional()
  upiId?: string;
}

export class DevotionalHeadersDto implements IDevotionalHeaders {
  @IsString()
  @IsOptional()
  left?: string;

  @IsString()
  @IsOptional()
  center?: string;

  @IsString()
  @IsOptional()
  right?: string;
}

export class UpdateCompanyDto implements IUpdateCompanyDetailsDto {
  @IsString()
  @IsOptional()
  millName?: string;

  @IsString()
  @IsOptional()
  tagline?: string;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsString()
  @IsOptional()
  fssaiNumber?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  alternatePhone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  contactPerson?: string;

  @ValidateNested()
  @Type(() => CompanyAddressDto)
  @IsOptional()
  address?: CompanyAddressDto;

  @ValidateNested()
  @Type(() => CompanyBankDetailsDto)
  @IsOptional()
  bankDetails?: CompanyBankDetailsDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  termsAndConditions?: string[];

  @IsString()
  @IsOptional()
  jurisdiction?: string;

  @ValidateNested()
  @Type(() => DevotionalHeadersDto)
  @IsOptional()
  devotionalHeaders?: DevotionalHeadersDto;
}
