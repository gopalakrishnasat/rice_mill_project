import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  ICompanyAddress,
  ICompanyBankDetails,
  IDevotionalHeaders,
  ICompanyDetails,
} from '@rice-mill-project/shared-types';

export type CompanyDocument = HydratedDocument<Company>;

@Schema({ _id: false })
export class CompanyAddress implements ICompanyAddress {
  @Prop({ type: String, required: true, default: '' })
  street!: string;

  @Prop({ type: String })
  taluka?: string;

  @Prop({ type: String })
  district?: string;

  @Prop({ type: String, required: true, default: '' })
  state!: string;

  @Prop({ type: String, required: true, default: '' })
  pincode!: string;
}
export const CompanyAddressSchema = SchemaFactory.createForClass(CompanyAddress);

@Schema({ _id: false })
export class CompanyBankDetails implements ICompanyBankDetails {
  @Prop({ type: String, required: true, default: '' })
  bankName!: string;

  @Prop({ type: String, required: true, default: '' })
  accountNumber!: string;

  @Prop({ type: String, required: true, default: '' })
  ifsc!: string;

  @Prop({ type: String, required: true, default: '' })
  branch!: string;

  @Prop({ type: String })
  upiId?: string;
}
export const CompanyBankDetailsSchema = SchemaFactory.createForClass(CompanyBankDetails);

@Schema({ _id: false })
export class DevotionalHeaders implements IDevotionalHeaders {
  @Prop({ type: String })
  left?: string;

  @Prop({ type: String })
  center?: string;

  @Prop({ type: String })
  right?: string;
}
export const DevotionalHeadersSchema = SchemaFactory.createForClass(DevotionalHeaders);

@Schema({
  timestamps: true,
  collection: 'company',
  toJSON: {
    virtuals: true,
    transform: (doc, ret: Record<string, any>) => {
      ret.id = ret._id ? ret._id.toString() : ret.id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Company implements Partial<ICompanyDetails> {
  @Prop({
    type: String,
    required: true,
    trim: true,
    default: '',
  })
  millName!: string;

  @Prop({ type: String, trim: true, default: '' })
  tagline?: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    default: '',
  })
  gstin!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    default: '',
  })
  fssaiNumber!: string;

  @Prop({ type: String, required: true, trim: true, default: '' })
  mobile!: string;

  @Prop({ type: String, trim: true })
  alternatePhone?: string;

  @Prop({ type: String, trim: true, lowercase: true })
  email?: string;

  @Prop({ type: String, trim: true })
  contactPerson?: string;

  @Prop({ type: CompanyAddressSchema, required: true, default: () => ({}) })
  address!: CompanyAddress;

  @Prop({ type: CompanyBankDetailsSchema, required: true, default: () => ({}) })
  bankDetails!: CompanyBankDetails;

  @Prop({
    type: [String],
    default: () => [],
  })
  termsAndConditions!: string[];

  @Prop({ type: String, trim: true, default: 'Pune' })
  jurisdiction!: string;

  @Prop({ type: DevotionalHeadersSchema, default: () => ({}) })
  devotionalHeaders?: DevotionalHeaders;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
