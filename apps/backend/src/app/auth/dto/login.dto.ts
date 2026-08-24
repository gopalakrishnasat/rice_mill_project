import { IsEmail, IsNotEmpty, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { LoginRequestDto } from '@rice-mill-project/shared-types';

export class LoginDto implements LoginRequestDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty({ message: 'Email address is required.' })
  email!: string;

  @IsNotEmpty({ message: 'Password is required.' })
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
