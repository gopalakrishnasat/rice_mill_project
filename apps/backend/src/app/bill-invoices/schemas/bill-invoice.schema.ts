import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import type { IBillInvoiceItem, IBillInvoiceCustomerSnapshot } from '@rice-mill-project/shared-types';

export type BillInvoiceDocument = HydratedDocument<BillInvoice>;

@Schema({
  timestamps: true,
  collection: 'dummy_invoices',
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: any) => {
      ret.id = ret._id ? ret._id.toString() : ret.id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    transform: (_doc, ret: any) => {
      ret.id = ret._id ? ret._id.toString() : ret.id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class BillInvoice {
  @Prop({ type: String, required: true, unique: true, index: true, uppercase: true, trim: true })
  billNumber!: string; // e.g. "BILL-2627-0001"

  @Prop({ type: Date, required: true, default: Date.now, index: true })
  date!: Date;

  @Prop({ type: String, required: false, uppercase: true, trim: true })
  vehicleNumber?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Customer', required: false, index: true })
  customerId?: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  customerSnapshot!: IBillInvoiceCustomerSnapshot;

  @Prop({
    type: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        unit: { type: String, required: true, default: 'Bag' },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true },
      },
    ],
    required: true,
  })
  items!: IBillInvoiceItem[];

  @Prop({ type: Number, required: true, default: 0 })
  subTotal!: number;

  @Prop({ type: Number, required: true, default: 0 })
  totalAmount!: number;

  @Prop({ type: String, required: false })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  createdBy?: string;
}

export const BillInvoiceSchema = SchemaFactory.createForClass(BillInvoice);
BillInvoiceSchema.index({ date: -1 });
BillInvoiceSchema.index({ 'customerSnapshot.companyName': 'text', billNumber: 'text', vehicleNumber: 'text' });
