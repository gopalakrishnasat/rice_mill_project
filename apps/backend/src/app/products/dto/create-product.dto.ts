import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { ProductCategory } from '@rice-mill-project/shared-types';

export class CreateProductDto {
  @IsString()
  @IsOptional()
  productCode?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ProductCategory)
  @IsNotEmpty()
  category!: ProductCategory;

  @IsString()
  @IsNotEmpty()
  hsnCode!: string;

  @IsNumber()
  @IsNotEmpty()
  bagWeightKg!: number;

  @IsString()
  @IsNotEmpty()
  unit!: 'BAG' | 'QUINTAL' | 'KG';

  @IsNumber()
  @IsNotEmpty()
  defaultRate!: number;

  @IsNumber()
  @IsOptional()
  taxRatePercent?: number;
}
