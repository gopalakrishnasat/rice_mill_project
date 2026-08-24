import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { InitialSuperAdminRequestDto } from '@rice-mill-project/shared-types';

export class InitialSuperAdminDto implements InitialSuperAdminRequestDto {
  @IsNotEmpty({ message: 'Super Admin full name is required.' })
  @IsString()
  name!: string;

  @IsEmail({}, { message: 'A valid email address is required.' })
  @IsNotEmpty({ message: 'Email address is required.' })
  email!: string;

  @IsNotEmpty({ message: 'A strong password is required.' })
  @MinLength(8, { message: 'Super Admin password must be at least 8 characters.' })
  password!: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  mobile?: string;
}
