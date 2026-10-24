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
      const superAdminEmail = 'superadmin@ricemill.com';
      const existing = await this.usersService.findByEmail(superAdminEmail);
      if (!existing) {
        const hashedPassword = await bcrypt.hash('SuperAdmin@123', 10);
        await (this.usersService as any).userModel.create({
          name: 'Executive Super Admin',
          email: superAdminEmail,
          password: hashedPassword,
          employeeId: 'EMP-001',
          mobile: '+91 9876543210',
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        });
        this.logger.log(`🌱 Seeded initial enterprise Super Admin: ${superAdminEmail}`);
      }
    } catch (error) {
      this.logger.error('Failed to seed initial users', error);
    }
  }
}
