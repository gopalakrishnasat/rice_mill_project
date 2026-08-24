import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface RecordAuditParams {
  userId?: string;
  action: string;
  module: string;
  performedBy?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async log(params: RecordAuditParams): Promise<AuditLogDocument | null> {
    try {
      const entry = new this.auditLogModel(params);
      const saved = await entry.save();
      this.logger.log(
        `[AUDIT] Action: ${params.action} | Module: ${params.module} | By: ${params.performedBy || 'SYSTEM'}`,
      );
      return saved;
    } catch (err) {
      this.logger.error('Failed to write audit log entry', err);
      return null;
    }
  }

  async getRecentLogs(limit = 50): Promise<AuditLogDocument[]> {
    return this.auditLogModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
