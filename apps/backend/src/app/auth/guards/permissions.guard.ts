import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  Permission,
  ROLE_PERMISSIONS,
  UserRole,
} from '@rice-mill-project/shared-types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      Permission[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('User authentication required.');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const userPermissions = ROLE_PERMISSIONS[user.role as UserRole] || [];
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Access denied: Required permissions [${requiredPermissions.join(
          ', ',
        )}] missing.`,
      );
    }

    return true;
  }
}
