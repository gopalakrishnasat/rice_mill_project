import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { IUser, ICustomerLedgerEntry } from '@rice-mill-project/shared-types';
import { AuditService } from '../common/audit/audit.service';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    private readonly auditService: AuditService,
  ) {}

  async getNextCustomerCode(): Promise<string> {
    const customers = await this.customerModel
      .find({ customerCode: { $regex: /^CUST-\d+$/i } }, { customerCode: 1 })
      .exec();

    let maxNum = 0;
    for (const c of customers) {
      if (c.customerCode) {
        const match = c.customerCode.match(/^CUST-(\d+)$/i);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    const nextNum = maxNum + 1;
    return `CUST-${String(nextNum).padStart(3, '0')}`;
  }

  async findAll(query?: {
    search?: string;
    isActive?: boolean;
    hasBalance?: boolean;
  }): Promise<CustomerDocument[]> {
    const filter: Record<string, any> = {};

    if (query?.isActive !== undefined) {
      filter.isActive = query.isActive;
    }
    if (query?.hasBalance) {
      filter.currentBalance = { $gt: 0 };
    }
    if (query?.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [
        { companyName: regex },
        { customerCode: regex },
        { mobile: regex },
        { email: regex },
        { gstin: regex },
        { 'billingAddress.city': regex },
      ];
    }

    const customers = await this.customerModel.find(filter).exec();

    // Natural sort by customerCode (CUST-001, CUST-002, ...)
    return customers.sort((a, b) => {
      const numA = parseInt(a.customerCode?.replace(/\D/g, '') || '9999', 10);
      const numB = parseInt(b.customerCode?.replace(/\D/g, '') || '9999', 10);
      return numA - numB;
    });
  }

  async findById(id: string): Promise<CustomerDocument | null> {
    return this.customerModel.findById(id).exec();
  }

  async findByCode(customerCode: string): Promise<CustomerDocument | null> {
    return this.customerModel
      .findOne({ customerCode: customerCode.toUpperCase().trim() })
      .exec();
  }

  async create(
    dto: CreateCustomerDto,
    actorUser?: IUser,
  ): Promise<CustomerDocument> {
    const finalCode = dto.customerCode
      ? dto.customerCode.toUpperCase().trim()
      : await this.getNextCustomerCode();

    const existingCode = await this.findByCode(finalCode);
    if (existingCode) {
      throw new ConflictException(
        `Customer with code "${finalCode}" already exists.`,
      );
    }

    const openingBalance = dto.openingBalance ?? 0;

    const newCustomer = new this.customerModel({
      customerCode: finalCode,
      companyName: dto.companyName.trim(),
      contactPerson: dto.contactPerson?.trim(),
      mobile: dto.mobile.trim(),
      email: dto.email?.toLowerCase().trim(),
      gstin: dto.gstin?.toUpperCase().trim(),
      pan: dto.pan?.toUpperCase().trim(),
      billingAddress: dto.billingAddress,
      shippingAddress: dto.shippingAddress || dto.billingAddress,
      creditLimit: dto.creditLimit ?? 0,
      openingBalance,
      currentBalance: openingBalance,
      totalBilled: 0,
      totalPaid: 0,
      isActive: true,
      notes: dto.notes?.trim(),
      createdBy: actorUser?.id,
    });

    const saved = await newCustomer.save();

    if (actorUser) {
      await this.auditService.log({
        userId: actorUser.id,
        action: 'CUSTOMER_CREATE',
        module: 'CUSTOMER_MANAGEMENT',
        performedBy: `${actorUser.name} (${actorUser.role})`,
        metadata: {
          customerId: saved._id.toString(),
          customerCode: saved.customerCode,
          companyName: saved.companyName,
        },
      });
    }

    return saved;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    actorUser?: IUser,
  ): Promise<CustomerDocument> {
    const customer = await this.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    if (dto.companyName !== undefined) customer.companyName = dto.companyName.trim();
    if (dto.contactPerson !== undefined) customer.contactPerson = dto.contactPerson?.trim();
    if (dto.mobile !== undefined) customer.mobile = dto.mobile.trim();
    if (dto.email !== undefined) customer.email = dto.email?.toLowerCase().trim();
    if (dto.gstin !== undefined) customer.gstin = dto.gstin?.toUpperCase().trim();
    if (dto.pan !== undefined) customer.pan = dto.pan?.toUpperCase().trim();
    if (dto.billingAddress !== undefined) customer.billingAddress = dto.billingAddress;
    if (dto.shippingAddress !== undefined) customer.shippingAddress = dto.shippingAddress;
    if (dto.creditLimit !== undefined) customer.creditLimit = dto.creditLimit;
    if (dto.isActive !== undefined) customer.isActive = dto.isActive;
    if (dto.notes !== undefined) customer.notes = dto.notes?.trim();

    const updated = await customer.save();

    if (actorUser) {
      await this.auditService.log({
        userId: actorUser.id,
        action: 'CUSTOMER_UPDATE',
        module: 'CUSTOMER_MANAGEMENT',
        performedBy: `${actorUser.name} (${actorUser.role})`,
        metadata: {
          customerId: updated._id.toString(),
          customerCode: updated.customerCode,
        },
      });
    }

    return updated;
  }

  async updateBalance(
    customerId: string,
    deltaBilled: number,
    deltaPaid: number,
  ): Promise<CustomerDocument | null> {
    return this.customerModel
      .findByIdAndUpdate(
        customerId,
        {
          $inc: {
            totalBilled: deltaBilled,
            totalPaid: deltaPaid,
            currentBalance: deltaBilled - deltaPaid,
          },
        },
        { new: true },
      )
      .exec();
  }
}
