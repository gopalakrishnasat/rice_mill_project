import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CreateUserRequestDto, UserRole } from '@rice-mill-project/shared-types';

export class CreateUserDto implements CreateUserRequestDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsNotEmpty({ message: 'Full name is required.' })
  @IsString()
  name!: string;

  @IsEmail({}, { message: 'A valid email address is required.' })
  @IsNotEmpty({ message: 'Email address is required.' })
  email!: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsNotEmpty({ message: 'Password is required.' })
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  password!: string;

  @IsEnum(UserRole, { message: 'A valid system role must be assigned.' })
  role!: UserRole;

  @IsOptional()
  mustChangePassword?: boolean;
}
