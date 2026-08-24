import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { InitialSuperAdminDto } from './dto/initial-super-admin.dto';

@Controller('setup')
export class SetupController {
  constructor(private readonly usersService: UsersService) {}

  @Get('status')
  async getSetupStatus() {
    const superAdminExists = await this.usersService.hasSuperAdmin();
    return {
      success: true,
      message: superAdminExists
        ? 'System is initialized. Super Admin exists.'
        : 'Initial system setup required. No Super Admin exists.',
      data: {
        superAdminExists,
      },
    };
  }

  @Post('initial-super-admin')
  @HttpCode(HttpStatus.CREATED)
  async createInitialSuperAdmin(@Body() dto: InitialSuperAdminDto) {
    const alreadyExists = await this.usersService.hasSuperAdmin();
    if (alreadyExists) {
      throw new ForbiddenException(
        'System initialization has already been completed. Initial Super Admin setup is permanently locked.',
      );
    }

    const superAdmin = await this.usersService.createInitialSuperAdmin(dto);
    return {
      success: true,
      message:
        'Initial Super Admin account created successfully. The system setup is now locked.',
      data: superAdmin,
    };
  }
}
