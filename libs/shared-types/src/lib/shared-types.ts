export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  VIEW_ONLY_ADMIN = 'VIEW_ONLY_ADMIN',
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

  // Product Catalog
  PRODUCT_VIEW = 'PRODUCT_VIEW',
  PRODUCT_MANAGE = 'PRODUCT_MANAGE',

  // Invoicing & Billing
  INVOICE_VIEW = 'INVOICE_VIEW',
  INVOICE_CREATE = 'INVOICE_CREATE',
  INVOICE_EDIT = 'INVOICE_EDIT',
  INVOICE_PRINT = 'INVOICE_PRINT',
  INVOICE_PAYMENT_RECORD = 'INVOICE_PAYMENT_RECORD',

  // Company Profile (EXCLUSIVELY Super Admin)
  COMPANY_VIEW = 'COMPANY_VIEW',
  COMPANY_MANAGE = 'COMPANY_MANAGE',
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
  ],
  [UserRole.VIEW_ONLY_ADMIN]: [
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_LEDGER_VIEW,
    Permission.PRODUCT_VIEW,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_PRINT,
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
  // creditLimit?: number;
  // openingBalance?: number;
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
  unit: 'BAG' | 'KG';
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
  unit: 'BAG' | 'KG';
  defaultRate: number;
  taxRatePercent?: number;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {
  isActive?: boolean;
}

/* ==========================================================================
   MILL & COMPANY PROFILE CONTRACTS
   ========================================================================== */

export interface ICompanyAddress {
  street: string;
  taluka?: string;
  district?: string;
  state: string;
  pincode: string;
}

export interface ICompanyBankDetails {
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  upiId?: string;
}

export interface IDevotionalHeaders {
  left?: string;
  center?: string;
  right?: string;
}

export interface ICompanyDetails {
  id?: string;
  _id?: string;
  millName: string;
  tagline?: string;
  gstin: string;
  fssaiNumber: string;
  mobile: string;
  alternatePhone?: string;
  email?: string;
  contactPerson?: string;
  address: ICompanyAddress;
  bankDetails: ICompanyBankDetails;
  termsAndConditions: string[];
  jurisdiction: string;
  devotionalHeaders?: IDevotionalHeaders;
  updatedAt?: string | Date;
}

export interface UpdateCompanyDetailsDto {
  millName?: string;
  tagline?: string;
  gstin?: string;
  fssaiNumber?: string;
  mobile?: string;
  alternatePhone?: string;
  email?: string;
  contactPerson?: string;
  address?: Partial<ICompanyAddress>;
  bankDetails?: Partial<ICompanyBankDetails>;
  termsAndConditions?: string[];
  jurisdiction?: string;
  devotionalHeaders?: Partial<IDevotionalHeaders>;
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
  description: string; // Product / Item name, e.g. "Rice", "Raw Rice (Kolam)"
  hsnCode: string; // "1006" / "80000000"
  uom?: string; // Bag weight / capacity, e.g. "30kg", "25kg", "50kg" (or "—" for loose Kg)
  qty: number; // Bag count or weight
  unit: string; // "Bag", "Kg"
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

