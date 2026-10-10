import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from './schemas/company.schema';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { AuditService } from '../common/audit/audit.service';
import { IUser } from '@rice-mill-project/shared-types';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly auditService: AuditService,
  ) {}

  async getCompanyDetails(): Promise<CompanyDocument> {
    let company = await this.companyModel.findOne().exec();
    if (!company) {
      this.logger.warn('No company profile found in database. Initializing blank record...');
      company = await this.companyModel.create({
        millName: '',
        tagline: '',
        gstin: '',
        fssaiNumber: '',
        mobile: '',
        jurisdiction: 'Pune',
        address: { street: '', state: '', pincode: '' },
        bankDetails: { bankName: '', accountNumber: '', ifsc: '', branch: '' },
        termsAndConditions: [],
        devotionalHeaders: {},
      });
    }
    return company;
  }

  async updateCompanyDetails(
    dto: UpdateCompanyDto,
    user?: IUser,
  ): Promise<CompanyDocument> {
    let company = await this.companyModel.findOne().exec();
    if (!company) {
      company = new this.companyModel({});
    }

    if (dto.millName !== undefined) company.millName = dto.millName;
    if (dto.tagline !== undefined) company.tagline = dto.tagline;
    if (dto.gstin !== undefined) company.gstin = dto.gstin.trim().toUpperCase();
    if (dto.fssaiNumber !== undefined) company.fssaiNumber = dto.fssaiNumber;
    if (dto.mobile !== undefined) company.mobile = dto.mobile;
    if (dto.alternatePhone !== undefined) company.alternatePhone = dto.alternatePhone;
    if (dto.email !== undefined) company.email = dto.email;
    if (dto.contactPerson !== undefined) company.contactPerson = dto.contactPerson;
    if (dto.jurisdiction !== undefined) company.jurisdiction = dto.jurisdiction;

    if (dto.address) {
      company.address = {
        ...company.address,
        ...dto.address,
      };
    }

    if (dto.bankDetails) {
      company.bankDetails = {
        ...company.bankDetails,
        ...dto.bankDetails,
      };
    }

    if (dto.termsAndConditions) {
      company.termsAndConditions = dto.termsAndConditions;
    }

    if (dto.devotionalHeaders) {
      company.devotionalHeaders = {
        ...company.devotionalHeaders,
        ...dto.devotionalHeaders,
      };
    }

    const saved = await company.save();

    await this.auditService.log({
      userId: user?.id,
      action: 'COMPANY_PROFILE_UPDATE',
      module: 'COMPANY',
      performedBy: user?.name || user?.email || 'ADMIN',
      metadata: {
        millName: saved.millName,
        gstin: saved.gstin,
        updatedAt: new Date().toISOString(),
      },
    });

    this.logger.log(`Company profile updated successfully by ${user?.name || user?.email || 'ADMIN'}`);
    return saved;
  }
}
