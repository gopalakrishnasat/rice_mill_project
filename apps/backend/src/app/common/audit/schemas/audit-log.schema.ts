import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({
  timestamps: true,
  collection: 'audit_logs',
})
export class AuditLog {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  userId?: string;

  @Prop({ type: String, required: true, index: true })
  action!: string;

  @Prop({ type: String, required: true, index: true })
  module!: string;

  @Prop({ type: String, required: false })
  performedBy?: string;

  @Prop({ type: String, required: false })
  ipAddress?: string;

  @Prop({ type: SchemaTypes.Mixed, required: false })
  metadata?: Record<string, any>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
