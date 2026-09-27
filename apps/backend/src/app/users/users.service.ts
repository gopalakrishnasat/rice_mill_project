import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { UserRole, IUser } from '@rice-mill-project/shared-types';
import { CreateUserDto } from './dto/create-user.dto';
import { AuditService } from '../common/audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly auditService: AuditService,
  ) {}

  async getNextEmployeeId(): Promise<string> {
    const users = await this.userModel
      .find({ employeeId: { $regex: /^EMP-\d+$/i } }, { employeeId: 1 })
      .exec();

    let maxNum = 0;
    for (const u of users) {
      if (u.employeeId) {
        const match = u.employeeId.match(/^EMP-(\d+)$/i);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    const nextNum = maxNum + 1;
    return `EMP-${String(nextNum).padStart(3, '0')}`;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmployeeId(employeeId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ employeeId: employeeId.toUpperCase().trim() })
      .exec();
  }

  async findAll(query?: {
    role?: UserRole;
    isActive?: boolean;
    search?: string;
  }): Promise<UserDocument[]> {
    const filter: Record<string, any> = {};

    if (query?.role) {
      filter.role = query.role;
    }
    if (query?.isActive !== undefined) {
      filter.isActive = query.isActive;
    }
    if (query?.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { employeeId: searchRegex },
        { mobile: searchRegex },
      ];
    }

    const users = await this.userModel.find(filter).exec();

    // Natural sort by employeeId (EMP-001, EMP-002, ...)
    return users.sort((a, b) => {
      const numA = parseInt(a.employeeId?.replace(/\D/g, '') || '9999', 10);
      const numB = parseInt(b.employeeId?.replace(/\D/g, '') || '9999', 10);
      return numA - numB;
    });
  }

  async hasSuperAdmin(): Promise<boolean> {
    const count = await this.userModel
      .countDocuments({ role: UserRole.SUPER_ADMIN })
      .exec();
    return count > 0;
  }

  async createInitialSuperAdmin(data: {
    name: string;
    email: string;
    password: string;
    employeeId?: string;
    mobile?: string;
  }): Promise<UserDocument> {
    const exists = await this.hasSuperAdmin();
    if (exists) {
      throw new ForbiddenException(
        'Initial setup has already been completed. Super Admin account exists.',
      );
    }

    const existingEmail = await this.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictException('A user with this email address already exists.');
    }

    const employeeId = data.employeeId || (await this.getNextEmployeeId());
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const superAdmin = new this.userModel({
      name: data.name,
      email: data.email.toLowerCase().trim(),
      password: hashedPassword,
      employeeId,
      mobile: data.mobile,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    });

    const saved = await superAdmin.save();

    await this.auditService.log({
      userId: saved._id.toString(),
      action: 'SUPER_ADMIN_BOOTSTRAP',
      module: 'SETUP',
      performedBy: 'SYSTEM_BOOTSTRAP',
      metadata: { email: saved.email, employeeId: saved.employeeId },
    });

    return saved;
  }

  async createUser(
    dto: CreateUserDto,
    creatorUser: IUser,
  ): Promise<UserDocument> {
    // 1. Role Hierarchy Check (Strict Super Admin check)
    if (creatorUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin is authorized to create user accounts.',
      );
    }

    // 2. Uniqueness check
    const existingEmail = await this.findByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException(
        `User with email "${dto.email}" already exists.`,
      );
    }

    // 3. Sequential Employee ID auto-generation
    const finalEmpId = dto.employeeId
      ? dto.employeeId.toUpperCase().trim()
      : await this.getNextEmployeeId();

    const existingEmpId = await this.findByEmployeeId(finalEmpId);
    if (existingEmpId) {
      throw new ConflictException(
        `User with Employee ID "${finalEmpId}" already exists.`,
      );
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const newUser = new this.userModel({
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      employeeId: finalEmpId,
      mobile: dto.mobile?.trim(),
      password: hashedPassword,
      role: dto.role,
      isActive: true,
      mustChangePassword: dto.mustChangePassword ?? false,
      createdBy: creatorUser.id,
    });

    const saved = await newUser.save();

    await this.auditService.log({
      userId: saved._id.toString(),
      action: 'USER_CREATE',
      module: 'USER_MANAGEMENT',
      performedBy: `${creatorUser.name} (${creatorUser.role})`,
      metadata: {
        createdUserId: saved._id.toString(),
        role: saved.role,
        employeeId: saved.employeeId,
      },
    });

    return saved;
  }

  async updateStatus(
    userId: string,
    isActive: boolean,
    reason: string | undefined,
    actorUser: IUser,
  ): Promise<UserDocument> {
    const targetUser = await this.findById(userId);
    if (!targetUser) {
      throw new NotFoundException('User not found.');
    }

    if (actorUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin is authorized to modify user status.',
      );
    }

    // Prevent deactivating the only active Super Admin
    if (targetUser.role === UserRole.SUPER_ADMIN && !isActive) {
      const activeSuperAdmins = await this.userModel
        .countDocuments({
          role: UserRole.SUPER_ADMIN,
          isActive: true,
          _id: { $ne: targetUser._id },
        })
        .exec();

      if (activeSuperAdmins === 0) {
        throw new ForbiddenException(
          'Cannot deactivate the only active Super Admin account.',
        );
      }
    }

    targetUser.isActive = isActive;
    const updated = await targetUser.save();

    await this.auditService.log({
      userId: targetUser._id.toString(),
      action: isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
      module: 'USER_MANAGEMENT',
      performedBy: `${actorUser.name} (${actorUser.role})`,
      metadata: { isActive, reason: reason || 'N/A' },
    });

    return updated;
  }

  async updateRole(
    userId: string,
    newRole: UserRole,
    actorUser: IUser,
  ): Promise<UserDocument> {
    const targetUser = await this.findById(userId);
    if (!targetUser) {
      throw new NotFoundException('User not found.');
    }

    if (actorUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin is authorized to modify user roles.',
      );
    }

    if (
      targetUser.role === UserRole.SUPER_ADMIN &&
      newRole !== UserRole.SUPER_ADMIN
    ) {
      const activeSuperAdmins = await this.userModel
        .countDocuments({
          role: UserRole.SUPER_ADMIN,
          _id: { $ne: targetUser._id },
        })
        .exec();

      if (activeSuperAdmins === 0) {
        throw new ForbiddenException(
          'Cannot demote the only remaining Super Admin account.',
        );
      }
    }

    const oldRole = targetUser.role;
    targetUser.role = newRole;
    const updated = await targetUser.save();

    await this.auditService.log({
      userId: targetUser._id.toString(),
      action: 'USER_ROLE_CHANGE',
      module: 'USER_MANAGEMENT',
      performedBy: `${actorUser.name} (${actorUser.role})`,
      metadata: { oldRole, newRole },
    });

    return updated;
  }

  async adminResetPassword(
    userId: string,
    newPass: string,
    actorUser: IUser,
  ): Promise<void> {
    const targetUser = await this.findById(userId);
    if (!targetUser) {
      throw new NotFoundException('User not found.');
    }

    if (actorUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin is authorized to reset employee passwords.',
      );
    }

    targetUser.password = await bcrypt.hash(newPass, 10);
    targetUser.mustChangePassword = true;
    await targetUser.save();

    await this.auditService.log({
      userId: targetUser._id.toString(),
      action: 'USER_PASSWORD_RESET',
      module: 'USER_MANAGEMENT',
      performedBy: `${actorUser.name} (${actorUser.role})`,
      metadata: { targetUserId: userId, forcedChange: true },
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { lastLoginAt: new Date() })
      .exec();
  }
}
