import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UpdateUserStatusRequestDto } from '@rice-mill-project/shared-types';

export class UpdateUserStatusDto implements UpdateUserStatusRequestDto {
  @IsNotEmpty({ message: 'Active status is required.' })
  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}
