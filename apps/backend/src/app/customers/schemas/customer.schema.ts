import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import { ICustomerAddress } from '@rice-mill-project/shared-types';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({
  timestamps: true,
  collection: 'customers',
})
export class Customer {
  @Prop({ type: String, required: true, unique: true, index: true, uppercase: true })
  customerCode!: string; // e.g. "CUST-001"

  @Prop({ type: String, required: true, trim: true, index: true })
  companyName!: string; // e.g. "Lunkad Foods Private Limited"

  @Prop({ type: String, required: false, trim: true })
  contactPerson?: string;

  @Prop({ type: String, required: true, trim: true, index: true })
  mobile!: string;

  @Prop({ type: String, required: false, trim: true, lowercase: true })
  email?: string;

  @Prop({ type: String, required: false, uppercase: true, trim: true, index: true })
  gstin?: string;

  @Prop({ type: String, required: false, uppercase: true, trim: true })
  pan?: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  billingAddress!: ICustomerAddress;

  @Prop({ type: SchemaTypes.Mixed, required: false })
  shippingAddress?: ICustomerAddress;

  @Prop({ type: Number, required: false, default: 0 })
  creditLimit?: number;

  @Prop({ type: Number, required: true, default: 0 })
  openingBalance!: number;

  @Prop({ type: Number, required: true, default: 0 })
  currentBalance!: number; // Positive = Receivable

  @Prop({ type: Number, required: true, default: 0 })
  totalBilled!: number;

  @Prop({ type: Number, required: true, default: 0 })
  totalPaid!: number;

  @Prop({ type: Boolean, required: true, default: true })
  isActive!: boolean;

  @Prop({ type: String, required: false })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ companyName: 'text', customerCode: 'text', mobile: 'text', gstin: 'text' });
