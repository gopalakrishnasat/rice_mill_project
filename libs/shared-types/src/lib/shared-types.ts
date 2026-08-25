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

  // Customer Management
  CUSTOMER_VIEW = 'CUSTOMER_VIEW',
  CUSTOMER_CREATE = 'CUSTOMER_CREATE',
  CUSTOMER_EDIT = 'CUSTOMER_EDIT',
  CUSTOMER_LEDGER_VIEW = 'CUSTOMER_LEDGER_VIEW',

  // Product & Inventory Catalog
  PRODUCT_VIEW = 'PRODUCT_VIEW',
  PRODUCT_MANAGE = 'PRODUCT_MANAGE',

  // Invoicing & Sales
  INVOICE_VIEW = 'INVOICE_VIEW',
  INVOICE_CREATE = 'INVOICE_CREATE',
  INVOICE_EDIT = 'INVOICE_EDIT',
  INVOICE_PRINT = 'INVOICE_PRINT',
  INVOICE_PAYMENT_RECORD = 'INVOICE_PAYMENT_RECORD',

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

  // Reports & Audits
  REPORT_VIEW = 'REPORT_VIEW',
  AUDIT_VIEW = 'AUDIT_VIEW',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ADMIN]: [
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_EDIT,
    Permission.CUSTOMER_LEDGER_VIEW,
    Permission.PRODUCT_VIEW,
    Permission.PRODUCT_MANAGE,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_CREATE,
    Permission.INVOICE_EDIT,
    Permission.INVOICE_PRINT,
    Permission.INVOICE_PAYMENT_RECORD,
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
    Permission.REPORT_VIEW,
    Permission.AUDIT_VIEW,
  ],
  [UserRole.SALES_MANAGER]: [
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_EDIT,
    Permission.CUSTOMER_LEDGER_VIEW,
    Permission.PRODUCT_VIEW,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_CREATE,
    Permission.INVOICE_EDIT,
    Permission.INVOICE_PRINT,
    Permission.INVOICE_PAYMENT_RECORD,
    Permission.SALES_VIEW,
    Permission.SALES_CREATE,
    Permission.REPORT_VIEW,
  ],
  [UserRole.ACCOUNTANT]: [
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_LEDGER_VIEW,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_PRINT,
    Permission.INVOICE_PAYMENT_RECORD,
    Permission.SALES_VIEW,
    Permission.REPORT_VIEW,
  ],
  [UserRole.MANAGER]: [
    Permission.CUSTOMER_VIEW,
    Permission.PRODUCT_VIEW,
    Permission.INVOICE_VIEW,
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
  [UserRole.STORE_MANAGER]: [
    Permission.PRODUCT_VIEW,
    Permission.PRODUCT_MANAGE,
    Permission.INVOICE_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_CREATE,
    Permission.INVENTORY_MANAGE,
    Permission.PROCUREMENT_VIEW,
  ],
  [UserRole.OPERATOR]: [
    Permission.INVOICE_VIEW,
    Permission.WEIGHBRIDGE_MANAGE,
    Permission.MILLING_VIEW,
    Permission.MILLING_MANAGE,
  ],
};

/* ==========================================================================
   USER & AUTH CONTRACTS
   ========================================================================== */

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

/* ==========================================================================
   CUSTOMER MANAGEMENT CONTRACTS
   ========================================================================== */

export interface ICustomerAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  stateCode: string; // e.g. "27" for Maharashtra
  pincode: string;
}

export interface ICustomer {
  id: string;
  customerCode: string; // e.g. "CUST-001"
  companyName: string; // Trade name (e.g. "Lunkad Foods Private Limited")
  contactPerson?: string;
  mobile: string;
  email?: string;
  gstin?: string;
  pan?: string;
  billingAddress: ICustomerAddress;
  shippingAddress?: ICustomerAddress;
  creditLimit?: number;
  openingBalance: number;
  currentBalance: number; // Positive = Outstanding Receivable, 0 = Clear
  totalBilled: number;
  totalPaid: number;
  isActive: boolean;
  notes?: string;
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateCustomerDto {
  customerCode?: string;
  companyName: string;
  contactPerson?: string;
  mobile: string;
  email?: string;
  gstin?: string;
  pan?: string;
  billingAddress: ICustomerAddress;
  shippingAddress?: ICustomerAddress;
  creditLimit?: number;
  openingBalance?: number;
  notes?: string;
}

export interface UpdateCustomerDto {
  companyName?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  billingAddress?: ICustomerAddress;
  shippingAddress?: ICustomerAddress;
  creditLimit?: number;
  notes?: string;
  isActive?: boolean;
}

/* ==========================================================================
   PRODUCT CATALOG CONTRACTS
   ========================================================================== */

export enum ProductCategory {
  RICE = 'RICE',
  BY_PRODUCT = 'BY_PRODUCT',
  PACKAGED = 'PACKAGED',
}

export interface IProduct {
  id: string;
  productCode: string; // e.g. "PROD-001"
  name: string; // e.g. "Murmura - 9kg Bag"
  category: ProductCategory;
  hsnCode: string; // e.g. "1006" or "80000000"
  bagWeightKg: number; // e.g. 9, 25, 50
  unit: 'BAG' | 'QUINTAL' | 'KG';
  defaultRate: number; // Default price per unit
  taxRatePercent: number; // e.g. 5 or 0
  isActive: boolean;
}

export interface CreateProductDto {
  productCode?: string;
  name: string;
  category: ProductCategory;
  hsnCode: string;
  bagWeightKg: number;
  unit: 'BAG' | 'QUINTAL' | 'KG';
  defaultRate: number;
  taxRatePercent?: number;
}

/* ==========================================================================
   INVOICE & BILLING ENGINE CONTRACTS
   ========================================================================== */

export enum InvoiceType {
  TAX_INVOICE = 'TAX_INVOICE',
  DELIVERY_CHALLAN = 'DELIVERY_CHALLAN',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

export enum PaymentMode {
  CASH = 'CASH',
  UPI = 'UPI',
  NEFT_RTGS = 'NEFT_RTGS',
  CHEQUE = 'CHEQUE',
}

export interface IInvoiceItem {
  productId?: string;
  description: string; // e.g. "Murmura - 9kg Bag"
  hsnCode: string; // "1006" / "80000000"
  qty: number; // Bag count or weight
  unit: string; // "Bag", "Kg", "Qtl"
  rate: number; // Rate per unit (₹)
  amount: number; // qty * rate
}

export interface IInvoiceBankDetails {
  bankName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  upiId?: string;
}

export interface IInvoice {
  id: string;
  invoiceNumber: string; // e.g. "MU2627-VC-0001"
  invoiceType: InvoiceType;
  invoiceDate: string | Date;
  dueDate?: string | Date;
  customerId: string;
  customerSnapshot: {
    customerCode: string;
    companyName: string;
    contactPerson?: string;
    mobile: string;
    email?: string;
    gstin?: string;
    billingAddress: ICustomerAddress;
  };
  reference?: string; // Order / PO Reference
  vehicleNumber?: string; // e.g. "MH14LB3947"
  transportDetails?: string;
  lrNumber?: string;
  items: IInvoiceItem[];
  subTotal: number;
  transportCharges: number;
  hamaliCharges: number;
  discount: number;
  taxableAmount: number;
  isInterState: boolean;
  cgstPercent: number;
  cgstAmount: number;
  sgstPercent: number;
  sgstAmount: number;
  igstPercent: number;
  igstAmount: number;
  roundOff: number;
  totalAmount: number;
  totalAmountWords: string;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  bankDetails: IInvoiceBankDetails;
  notes?: string;
  terms?: string;
  createdBy?: string;
  issuedBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateInvoiceDto {
  invoiceNumber?: string;
  invoiceType: InvoiceType;
  invoiceDate: string | Date;
  dueDate?: string | Date;
  customerId: string;
  reference?: string;
  vehicleNumber?: string;
  transportDetails?: string;
  lrNumber?: string;
  items: IInvoiceItem[];
  transportCharges?: number;
  hamaliCharges?: number;
  discount?: number;
  isInterState?: boolean;
  status?: InvoiceStatus;
  notes?: string;
}

export interface UpdateInvoiceDto {
  invoiceType?: InvoiceType;
  invoiceDate?: string | Date;
  dueDate?: string | Date;
  reference?: string;
  vehicleNumber?: string;
  transportDetails?: string;
  lrNumber?: string;
  items?: IInvoiceItem[];
  transportCharges?: number;
  hamaliCharges?: number;
  discount?: number;
  isInterState?: boolean;
  status?: InvoiceStatus;
  notes?: string;
}

export interface RecordPaymentDto {
  amount: number;
  paymentDate: string | Date;
  paymentMode: PaymentMode;
  transactionReference?: string; // Cheque No / UTR / UPI Ref
  notes?: string;
}

export interface ICustomerLedgerEntry {
  id: string;
  date: string | Date;
  type: 'INVOICE' | 'PAYMENT' | 'OPENING_BALANCE' | 'CREDIT_NOTE';
  referenceNo: string; // Invoice # or Payment Receipt #
  description: string;
  debit: number; // Invoice / Charges amount
  credit: number; // Payment received
  runningBalance: number; // Positive = Receivable
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
