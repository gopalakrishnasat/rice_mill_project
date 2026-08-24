export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  OPERATOR = 'OPERATOR',
  ACCOUNTANT = 'ACCOUNTANT',
  STORE_MANAGER = 'STORE_MANAGER',
  SALES_MANAGER = 'SALES_MANAGER',
}

export enum Permission {
  // User Management (EXCLUSIVELY Super Admin)
  USER_CREATE = 'USER_CREATE',
  USER_READ = 'USER_READ',
  USER_UPDATE = 'USER_UPDATE',
  USER_DEACTIVATE = 'USER_DEACTIVATE',
  USER_RESET_PASSWORD = 'USER_RESET_PASSWORD',

  // Procurement & Weighbridge
  PROCUREMENT_VIEW = 'PROCUREMENT_VIEW',
  PROCUREMENT_CREATE = 'PROCUREMENT_CREATE',
  PROCUREMENT_EDIT = 'PROCUREMENT_EDIT',
  WEIGHBRIDGE_MANAGE = 'WEIGHBRIDGE_MANAGE',

  // Milling & Production
  MILLING_VIEW = 'MILLING_VIEW',
  MILLING_MANAGE = 'MILLING_MANAGE',

  // Inventory & Godowns
  INVENTORY_VIEW = 'INVENTORY_VIEW',
  INVENTORY_CREATE = 'INVENTORY_CREATE',
  INVENTORY_MANAGE = 'INVENTORY_MANAGE',

  // Sales & Billing
  SALES_VIEW = 'SALES_VIEW',
  SALES_CREATE = 'SALES_CREATE',
  INVOICE_CREATE = 'INVOICE_CREATE',

  // Reports & Audits
  REPORT_VIEW = 'REPORT_VIEW',
  AUDIT_VIEW = 'AUDIT_VIEW',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ADMIN]: [
    Permission.PROCUREMENT_VIEW,
    Permission.PROCUREMENT_CREATE,
    Permission.PROCUREMENT_EDIT,
    Permission.WEIGHBRIDGE_MANAGE,
    Permission.MILLING_VIEW,
    Permission.MILLING_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_CREATE,
    Permission.INVENTORY_MANAGE,
    Permission.SALES_VIEW,
    Permission.SALES_CREATE,
    Permission.INVOICE_CREATE,
    Permission.REPORT_VIEW,
    Permission.AUDIT_VIEW,
  ],
  [UserRole.MANAGER]: [
    Permission.PROCUREMENT_VIEW,
    Permission.PROCUREMENT_CREATE,
    Permission.PROCUREMENT_EDIT,
    Permission.WEIGHBRIDGE_MANAGE,
    Permission.MILLING_VIEW,
    Permission.MILLING_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_MANAGE,
    Permission.SALES_VIEW,
    Permission.REPORT_VIEW,
  ],
  [UserRole.OPERATOR]: [
    Permission.WEIGHBRIDGE_MANAGE,
    Permission.MILLING_VIEW,
    Permission.MILLING_MANAGE,
  ],
  [UserRole.ACCOUNTANT]: [
    Permission.PROCUREMENT_VIEW,
    Permission.SALES_VIEW,
    Permission.INVOICE_CREATE,
    Permission.REPORT_VIEW,
  ],
  [UserRole.STORE_MANAGER]: [
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_CREATE,
    Permission.INVENTORY_MANAGE,
    Permission.PROCUREMENT_VIEW,
  ],
  [UserRole.SALES_MANAGER]: [
    Permission.SALES_VIEW,
    Permission.SALES_CREATE,
    Permission.INVOICE_CREATE,
    Permission.REPORT_VIEW,
  ],
};

export interface IUser {
  id: string;
  employeeId?: string;
  name: string;
  email: string;
  mobile?: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string | Date;
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface LoginRequestDto {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponseData {
  accessToken: string;
  user: IUser;
  permissions?: Permission[];
}

export interface CreateUserRequestDto {
  employeeId?: string;
  name: string;
  email: string;
  mobile?: string;
  password: string;
  role: UserRole;
  mustChangePassword?: boolean;
}

export interface UpdateUserRoleRequestDto {
  role: UserRole;
}

export interface UpdateUserStatusRequestDto {
  isActive: boolean;
  reason?: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface SetupStatusResponseDto {
  superAdminExists: boolean;
  initializedAt?: string | Date;
}

export interface InitialSuperAdminRequestDto {
  name: string;
  email: string;
  password: string;
  employeeId?: string;
  mobile?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  statusCode?: number;
  timestamp?: string;
  path?: string;
}
