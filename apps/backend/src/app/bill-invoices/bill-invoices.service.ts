import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BillInvoice, BillInvoiceDocument } from './schemas/bill-invoice.schema';
import {
  CreateBillInvoiceDto,
  UpdateBillInvoiceDto,
  IBillInvoice,
} from '@rice-mill-project/shared-types';
import { CustomersService } from '../customers/customers.service';

@Injectable()
export class BillInvoicesService {
  constructor(
    @InjectModel(BillInvoice.name)
    private readonly billInvoiceModel: Model<BillInvoiceDocument>,
    @Optional()
    private readonly customersService?: CustomersService,
  ) {}

  getFinancialYearPrefix(date: Date = new Date()): string {
    const month = date.getMonth(); // 0 = Jan, 3 = April
    const year = date.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = (startYear + 1) % 100;
    const startYearShort = startYear % 100;
    return `BILL-${startYearShort}${endYear}-`;
  }

  async getNextBillNumber(): Promise<string> {
    const prefix = this.getFinancialYearPrefix();
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');

    const bills = await this.billInvoiceModel
      .find({ billNumber: { $regex: regex } }, { billNumber: 1 })
      .exec();

    let maxNum = 0;
    for (const b of bills) {
      const match = b.billNumber.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  async create(
    dto: CreateBillInvoiceDto,
    userId?: string,
  ): Promise<BillInvoiceDocument> {
    const billNumber = dto.billNumber?.trim() || (await this.getNextBillNumber());

    // Resolve customer snapshot if customerId is provided but snapshot details are sparse
    let customerSnapshot = dto.customerSnapshot;
    if (dto.customerId && (!customerSnapshot || !customerSnapshot.companyName)) {
      if (this.customersService) {
        const customer = await this.customersService.findById(dto.customerId);
        if (customer) {
          const addressLines = [
            customer.billingAddress?.line1,
            customer.billingAddress?.line2,
            customer.billingAddress?.city && customer.billingAddress?.pincode
              ? `${customer.billingAddress.city} - ${customer.billingAddress.pincode}`
              : customer.billingAddress?.city || '',
          ].filter(Boolean);

          customerSnapshot = {
            companyName: customer.companyName,
            billingAddress: addressLines.join('\n'),
            mobile: customer.mobile,
          };
        }
      }
    }

    if (!customerSnapshot || !customerSnapshot.companyName) {
      customerSnapshot = {
        companyName: 'Cash Customer',
        billingAddress: '',
      };
    }

    // Calculate item amounts and totals
    let subTotal = 0;
    const computedItems = (dto.items || []).map((item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const amount = Number((qty * rate).toFixed(2));
      subTotal += amount;
      return {
        description: item.description,
        quantity: qty,
        unit: item.unit || 'Bag',
        rate,
        amount,
      };
    });

    subTotal = Number(subTotal.toFixed(2));
    const totalAmount = subTotal;

    const newBill = new this.billInvoiceModel({
      billNumber,
      date: dto.date ? new Date(dto.date) : new Date(),
      vehicleNumber: dto.vehicleNumber ? dto.vehicleNumber.trim().toUpperCase() : undefined,
      customerId: dto.customerId || undefined,
      customerSnapshot,
      items: computedItems,
      subTotal,
      totalAmount,
      notes: dto.notes,
      createdBy: userId,
    });

    return await newBill.save();
  }

  async findAll(query?: {
    search?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<BillInvoiceDocument[]> {
    const filter: any = {};

    if (
      query?.customerId &&
      query.customerId.trim() &&
      query.customerId !== 'undefined' &&
      query.customerId !== 'null'
    ) {
      const cId = query.customerId.trim();
      if (Types.ObjectId.isValid(cId)) {
        filter.customerId = {
          $in: [cId, new Types.ObjectId(cId)],
        };
      }
    }

    if (
      query?.search &&
      query.search.trim() &&
      query.search !== 'undefined' &&
      query.search !== 'null'
    ) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { billNumber: searchRegex },
        { 'customerSnapshot.companyName': searchRegex },
        { vehicleNumber: searchRegex },
      ];
    }

    if (query?.startDate || query?.endDate) {
      const dateFilter: any = {};
      if (
        query.startDate &&
        query.startDate !== 'undefined' &&
        query.startDate !== 'null' &&
        !isNaN(Date.parse(query.startDate))
      ) {
        dateFilter.$gte = new Date(query.startDate);
      }
      if (
        query.endDate &&
        query.endDate !== 'undefined' &&
        query.endDate !== 'null' &&
        !isNaN(Date.parse(query.endDate))
      ) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      if (Object.keys(dateFilter).length > 0) {
        filter.date = dateFilter;
      }
    }

    return await this.billInvoiceModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<BillInvoiceDocument> {
    const bill = await this.billInvoiceModel.findById(id).exec();
    if (!bill) {
      throw new NotFoundException(`Bill invoice with ID ${id} not found.`);
    }
    return bill;
  }

  async update(
    id: string,
    dto: UpdateBillInvoiceDto,
    userId?: string,
  ): Promise<BillInvoiceDocument> {
    const bill = await this.findById(id);

    if (dto.billNumber) {
      bill.billNumber = dto.billNumber.trim().toUpperCase();
    }
    if (dto.date) {
      bill.date = new Date(dto.date);
    }
    if (dto.vehicleNumber !== undefined) {
      bill.vehicleNumber = dto.vehicleNumber ? dto.vehicleNumber.trim().toUpperCase() : undefined;
    }
    if (dto.customerId !== undefined) {
      bill.customerId = dto.customerId || undefined;
    }
    if (dto.customerSnapshot) {
      bill.customerSnapshot = dto.customerSnapshot;
    }
    if (dto.notes !== undefined) {
      bill.notes = dto.notes;
    }

    if (dto.items && dto.items.length > 0) {
      let subTotal = 0;
      const computedItems = dto.items.map((item) => {
        const qty = Number(item.quantity) || 0;
        const rate = Number(item.rate) || 0;
        const amount = Number((qty * rate).toFixed(2));
        subTotal += amount;
        return {
          description: item.description,
          quantity: qty,
          unit: item.unit || 'Bag',
          rate,
          amount,
        };
      });

      bill.items = computedItems;
      bill.subTotal = Number(subTotal.toFixed(2));
      bill.totalAmount = bill.subTotal;
    }

    return await bill.save();
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.billInvoiceModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Bill invoice with ID ${id} not found.`);
    }
    return { success: true, message: 'Bill invoice deleted successfully.' };
  }
}
