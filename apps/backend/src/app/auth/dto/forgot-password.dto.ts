import { IsEmail, IsNotEmpty } from 'class-validator';
import { ForgotPasswordRequestDto } from '@rice-mill-project/shared-types';

export class ForgotPasswordDto implements ForgotPasswordRequestDto {
  @IsEmail({}, { message: 'Please provide a valid registered email address.' })
  @IsNotEmpty({ message: 'Email address is required.' })
  email!: string;
}
