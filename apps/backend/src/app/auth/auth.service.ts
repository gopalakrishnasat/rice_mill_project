import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponseData,
  IUser,
  ROLE_PERMISSIONS,
  UserRole,
} from '@rice-mill-project/shared-types';
import { AuditService } from '../common/audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async validateAndLogin(
    loginDto: LoginDto,
    ipAddress?: string,
  ): Promise<AuthResponseData> {
    const { email, password, rememberMe } = loginDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      await this.auditService.log({
        action: 'USER_LOGIN_FAILED',
        module: 'AUTH',
        ipAddress,
        metadata: { email, reason: 'User not found' },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.auditService.log({
        userId: user._id.toString(),
        action: 'USER_LOGIN_FAILED',
        module: 'AUTH',
        ipAddress,
        performedBy: user.email,
        metadata: { reason: 'Incorrect password' },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      await this.auditService.log({
        userId: user._id.toString(),
        action: 'USER_LOGIN_DISABLED_ATTEMPT',
        module: 'AUTH',
        ipAddress,
        performedBy: user.email,
        metadata: { role: user.role },
      });
      throw new ForbiddenException(
        'Your account is currently disabled. Please contact your mill administrator.',
      );
    }

    const userId = user._id.toString();
    const payload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d');
    const options: JwtSignOptions = { expiresIn: expiresIn as any };
    const accessToken = this.jwtService.sign(payload, options);

    // Update last login timestamp
    await this.usersService.updateLastLogin(userId);

    // Record successful login in audit log
    await this.auditService.log({
      userId,
      action: 'USER_LOGIN',
      module: 'AUTH',
      performedBy: `${user.name} (${user.role})`,
      ipAddress,
      metadata: { role: user.role, rememberMe },
    });

    const safeUser: IUser = {
      id: userId,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: new Date(),
      createdBy: user.createdBy,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const permissions = ROLE_PERMISSIONS[user.role as UserRole] || [];

    return {
      accessToken,
      user: safeUser,
      permissions,
    };
  }

  async forgotPassword(
    email: string,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (user) {
      await this.auditService.log({
        userId: user._id.toString(),
        action: 'FORGOT_PASSWORD_REQUEST',
        module: 'AUTH',
        ipAddress,
        performedBy: user.email,
        metadata: { email: user.email },
      });
    } else {
      await this.auditService.log({
        action: 'FORGOT_PASSWORD_REQUEST_UNKNOWN_EMAIL',
        module: 'AUTH',
        ipAddress,
        metadata: { email },
      });
    }

    return {
      message:
        'If your account is registered in our system, password reset instructions have been forwarded to the mill system administrator.',
    };
  }
}
