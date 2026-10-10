import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ProductCategory } from '@rice-mill-project/shared-types';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  productCode?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @IsString()
  @IsOptional()
  hsnCode?: string;

  @IsNumber()
  @IsOptional()
  bagWeightKg?: number;

  @IsString()
  @IsOptional()
  unit?: 'BAG' | 'KG';

  @IsNumber()
  @IsOptional()
  defaultRate?: number;

  @IsNumber()
  @IsOptional()
  taxRatePercent?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
