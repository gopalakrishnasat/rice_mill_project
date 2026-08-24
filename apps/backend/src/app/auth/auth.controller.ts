import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Ip,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  AuthResponseData,
  IUser,
  Permission,
  ROLE_PERMISSIONS,
  UserRole,
} from '@rice-mill-project/shared-types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
  ): Promise<{ success: boolean; message: string; data: AuthResponseData }> {
    const authData = await this.authService.validateAndLogin(
      loginDto,
      ipAddress,
    );
    return {
      success: true,
      message: 'Login successful. Welcome to Rice Mill ERP.',
      data: authData,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @Req() req: { user: IUser },
  ): Promise<{
    success: boolean;
    message: string;
    data: { user: IUser; permissions: Permission[] };
  }> {
    const permissions = ROLE_PERMISSIONS[req.user.role as UserRole] || [];
    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: req.user,
        permissions,
      },
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ip() ipAddress: string,
  ) {
    const result = await this.authService.forgotPassword(
      dto.email,
      ipAddress,
    );
    return {
      success: true,
      message: result.message,
    };
  }
}
