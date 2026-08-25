import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import { PaymentMode } from '@rice-mill-project/shared-types';

export type PaymentReceiptDocument = HydratedDocument<PaymentReceipt>;

@Schema({
  timestamps: true,
  collection: 'payment_receipts',
})
export class PaymentReceipt {
  @Prop({ type: String, required: true, unique: true, index: true, uppercase: true })
  receiptNumber!: string; // e.g. "REC-001"

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Customer', required: true, index: true })
  customerId!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Invoice', required: false, index: true })
  invoiceId?: string;

  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: Date, required: true, default: Date.now })
  paymentDate!: Date;

  @Prop({
    type: String,
    enum: Object.values(PaymentMode),
    required: true,
    default: PaymentMode.CASH,
  })
  paymentMode!: PaymentMode;

  @Prop({ type: String, required: false, trim: true })
  transactionReference?: string; // Cheque # / UTR / UPI Ref

  @Prop({ type: String, required: false })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  recordedBy?: string;
}

export const PaymentReceiptSchema = SchemaFactory.createForClass(PaymentReceipt);
