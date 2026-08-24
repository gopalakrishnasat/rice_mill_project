import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/users.service';
import { UserRole } from '@rice-mill-project/shared-types';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly usersService: UsersService) {}

  async onApplicationBootstrap() {
    await this.seedInitialUsers();
  }

  private async seedInitialUsers() {
    try {
      const defaultUsers = [
        {
          name: 'Executive Super Admin',
          email: 'superadmin@ricemill.com',
          password: 'SuperAdmin@123',
          employeeId: 'EMP-001',
          mobile: '+91 9876543210',
          role: UserRole.SUPER_ADMIN,
        },
        {
          name: 'Mill Administrator',
          email: 'admin@ricemill.com',
          password: 'Admin@123',
          employeeId: 'EMP-002',
          mobile: '+91 9876543211',
          role: UserRole.ADMIN,
        },
        {
          name: 'Plant Operations Manager',
          email: 'manager@ricemill.com',
          password: 'Manager@123',
          employeeId: 'EMP-003',
          mobile: '+91 9876543212',
          role: UserRole.MANAGER,
        },
        {
          name: 'Godown & Store Manager',
          email: 'store@ricemill.com',
          password: 'Store@123',
          employeeId: 'EMP-004',
          mobile: '+91 9876543213',
          role: UserRole.STORE_MANAGER,
        },
        {
          name: 'Commercial Sales Manager',
          email: 'sales@ricemill.com',
          password: 'Sales@123',
          employeeId: 'EMP-005',
          mobile: '+91 9876543214',
          role: UserRole.SALES_MANAGER,
        },
        {
          name: 'Milling & Weighbridge Operator',
          email: 'operator@ricemill.com',
          password: 'Operator@123',
          employeeId: 'EMP-006',
          mobile: '+91 9876543215',
          role: UserRole.OPERATOR,
        },
        {
          name: 'Head Accountant',
          email: 'accountant@ricemill.com',
          password: 'Accountant@123',
          employeeId: 'EMP-007',
          mobile: '+91 9876543216',
          role: UserRole.ACCOUNTANT,
        },
      ];

      for (const user of defaultUsers) {
        const existing = await this.usersService.findByEmail(user.email);
        if (!existing) {
          const hashedPassword = await bcrypt.hash(user.password, 10);
          await (this.usersService as any).userModel.create({
            name: user.name,
            email: user.email.toLowerCase(),
            password: hashedPassword,
            employeeId: user.employeeId,
            mobile: user.mobile,
            role: user.role,
            isActive: true,
          });
          this.logger.log(
            `🌱 Seeded initial enterprise role: ${user.email} (${user.role}) [${user.employeeId}]`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to seed initial users', error);
    }
  }
}
