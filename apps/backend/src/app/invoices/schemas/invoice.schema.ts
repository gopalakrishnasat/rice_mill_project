import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import {
  InvoiceType,
  InvoiceStatus,
  PaymentStatus,
  IInvoiceItem,
  IInvoiceBankDetails,
  ICustomerAddress,
} from '@rice-mill-project/shared-types';

export type InvoiceDocument = HydratedDocument<Invoice>;

@Schema({
  timestamps: true,
  collection: 'invoices',
})
export class Invoice {
  @Prop({ type: String, required: true, unique: true, index: true, uppercase: true })
  invoiceNumber!: string; // e.g. "MU2627-VC-0001"

  @Prop({
    type: String,
    enum: Object.values(InvoiceType),
    required: true,
    default: InvoiceType.TAX_INVOICE,
  })
  invoiceType!: InvoiceType;

  @Prop({ type: Date, required: true, default: Date.now, index: true })
  invoiceDate!: Date;

  @Prop({ type: Date, required: false })
  dueDate?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Customer', required: true, index: true })
  customerId!: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  customerSnapshot!: {
    customerCode: string;
    companyName: string;
    contactPerson?: string;
    mobile: string;
    email?: string;
    gstin?: string;
    billingAddress: ICustomerAddress;
  };

  @Prop({ type: String, required: false, trim: true })
  reference?: string;

  @Prop({ type: String, required: false, uppercase: true, trim: true, index: true })
  vehicleNumber?: string; // e.g. "MH14LB3947"

  @Prop({ type: String, required: false, trim: true })
  transportDetails?: string;

  @Prop({ type: String, required: false, trim: true })
  lrNumber?: string;

  @Prop({ type: [SchemaTypes.Mixed], required: true })
  items!: IInvoiceItem[];

  @Prop({ type: Number, required: true, default: 0 })
  subTotal!: number;

  @Prop({ type: Number, required: true, default: 0 })
  transportCharges!: number;

  @Prop({ type: Number, required: true, default: 0 })
  hamaliCharges!: number;

  @Prop({ type: Number, required: true, default: 0 })
  discount!: number;

  @Prop({ type: Number, required: true, default: 0 })
  taxableAmount!: number;

  @Prop({ type: Boolean, required: true, default: false })
  isInterState!: boolean;

  @Prop({ type: Number, required: true, default: 2.5 })
  cgstPercent!: number;

  @Prop({ type: Number, required: true, default: 0 })
  cgstAmount!: number;

  @Prop({ type: Number, required: true, default: 2.5 })
  sgstPercent!: number;

  @Prop({ type: Number, required: true, default: 0 })
  sgstAmount!: number;

  @Prop({ type: Number, required: true, default: 5.0 })
  igstPercent!: number;

  @Prop({ type: Number, required: true, default: 0 })
  igstAmount!: number;

  @Prop({ type: Number, required: true, default: 0 })
  roundOff!: number;

  @Prop({ type: Number, required: true, default: 0 })
  totalAmount!: number;

  @Prop({ type: String, required: true })
  totalAmountWords!: string;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    required: true,
    default: PaymentStatus.UNPAID,
    index: true,
  })
  paymentStatus!: PaymentStatus;

  @Prop({ type: Number, required: true, default: 0 })
  paidAmount!: number;

  @Prop({ type: Number, required: true, default: 0 })
  balanceAmount!: number;

  @Prop({
    type: String,
    enum: Object.values(InvoiceStatus),
    required: true,
    default: InvoiceStatus.ISSUED,
    index: true,
  })
  status!: InvoiceStatus;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  bankDetails!: IInvoiceBankDetails;

  @Prop({ type: String, required: false })
  notes?: string;

  @Prop({ type: String, required: false })
  terms?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: string;

  @Prop({ type: String, required: false })
  issuedBy?: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
InvoiceSchema.index({ invoiceNumber: 'text', vehicleNumber: 'text', 'customerSnapshot.companyName': 'text' });
