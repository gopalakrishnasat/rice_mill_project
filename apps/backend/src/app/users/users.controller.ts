import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AdminResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, IUser } from '@rice-mill-project/shared-types';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @Req() req: { user: IUser },
  ) {
    const user = await this.usersService.createUser(createUserDto, req.user);
    return {
      success: true,
      message: `Employee account created successfully for ${user.name} (${user.employeeId}).`,
      data: user,
    };
  }

  @Get('next-employee-id')
  @Roles(UserRole.SUPER_ADMIN)
  async getNextEmployeeId() {
    const nextId = await this.usersService.getNextEmployeeId();
    return {
      success: true,
      message: 'Next sequential Employee ID generated successfully.',
      data: {
        nextEmployeeId: nextId,
      },
    };
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  async listUsers(
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const isActiveBool =
      isActive !== undefined ? isActive === 'true' : undefined;
    const users = await this.usersService.findAll({
      role,
      isActive: isActiveBool,
      search,
    });
    return {
      success: true,
      message: 'Users retrieved successfully.',
      data: users,
    };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return {
      success: true,
      message: 'User retrieved successfully.',
      data: user,
    };
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: { user: IUser },
  ) {
    const updated = await this.usersService.updateStatus(
      id,
      dto.isActive,
      dto.reason,
      req.user,
    );
    const action = dto.isActive ? 'activated' : 'deactivated';
    return {
      success: true,
      message: `User ${updated.name} has been ${action} successfully.`,
      data: updated,
    };
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPER_ADMIN)
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: { user: IUser },
  ) {
    const updated = await this.usersService.updateRole(
      id,
      dto.role,
      req.user,
    );
    return {
      success: true,
      message: `User role updated to ${dto.role} successfully.`,
      data: updated,
    };
  }

  @Post(':id/reset-password')
  @Roles(UserRole.SUPER_ADMIN)
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
    @Req() req: { user: IUser },
  ) {
    await this.usersService.adminResetPassword(
      id,
      dto.newPassword,
      req.user,
    );
    return {
      success: true,
      message:
        'Password has been reset successfully. User will be prompted to change password on next login.',
    };
  }
}
