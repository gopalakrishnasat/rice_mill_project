import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AdminResetPasswordDto {
  @IsNotEmpty({ message: 'New password is required.' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  newPassword!: string;
}
