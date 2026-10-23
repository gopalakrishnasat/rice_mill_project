import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import {
  PaymentReceipt,
  PaymentReceiptDocument,
} from './schemas/payment-receipt.schema';
import { CustomersService } from '../customers/customers.service';
import { CustomerDocument } from '../customers/schemas/customer.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import {
  InvoiceType,
  InvoiceStatus,
  PaymentStatus,
  IUser,
  IInvoiceBankDetails,
  ICustomerLedgerEntry,
} from '@rice-mill-project/shared-types';
import { convertNumberToIndianWords } from './utils/number-to-words.util';
import { AuditService } from '../common/audit/audit.service';
import { CompanyService } from '../company/company.service';

const MILL_BANK_DETAILS: IInvoiceBankDetails = {
  bankName: 'HDFC Bank Ltd',
  accountNo: '50200067891234',
  ifsc: 'HDFC0001234',
  branch: 'Narayangaon Branch, Pune',
  upiId: 'slricemill@hdfcbank',
};

const MILL_STATE_CODE = '27'; // Maharashtra State Code

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(PaymentReceipt.name)
    private readonly paymentReceiptModel: Model<PaymentReceiptDocument>,
    private readonly customersService: CustomersService,
    private readonly auditService: AuditService,
    private readonly companyService: CompanyService,
  ) {}

  getFinancialYearPrefix(date: Date = new Date()): string {
    const month = date.getMonth(); // 0 = Jan, 3 = April
    const year = date.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = (startYear + 1) % 100;
    const startYearShort = startYear % 100;
    return `MU${startYearShort}${endYear}-VC-`;
  }

  async getNextInvoiceNumber(): Promise<string> {
    const prefix = this.getFinancialYearPrefix();
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');

    const invoices = await this.invoiceModel
      .find({ invoiceNumber: { $regex: regex } }, { invoiceNumber: 1 })
      .exec();

    let maxNum = 0;
    for (const inv of invoices) {
      const match = inv.invoiceNumber.match(regex);
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

  calculateTotals(
    items: any[],
    transportCharges = 0,
    hamaliCharges = 0,
    discount = 0,
    isInterState = false,
    invoiceType: InvoiceType = InvoiceType.TAX_INVOICE,
    gstRate?: number,
  ) {
    let subTotal = 0;
    const computedItems = items.map((item) => {
      const amount = Number((item.qty * item.rate).toFixed(2));
      subTotal += amount;
      return { ...item, amount };
    });

    subTotal = Number(subTotal.toFixed(2));
    const taxableAmount = Number(
      Math.max(0, subTotal + transportCharges + hamaliCharges - discount).toFixed(2),
    );

    let effectiveGstRate = 0;
    let cgstPercent = 0;
    let cgstAmount = 0;
    let sgstPercent = 0;
    let sgstAmount = 0;
    let igstPercent = 0;
    let igstAmount = 0;

    if (invoiceType === InvoiceType.TAX_INVOICE) {
      effectiveGstRate = typeof gstRate === 'number' && !isNaN(gstRate) && gstRate >= 0
        ? gstRate
        : 5.0;

      if (isInterState) {
        igstPercent = effectiveGstRate;
        igstAmount = Number(((taxableAmount * igstPercent) / 100).toFixed(2));
      } else {
        cgstPercent = Number((effectiveGstRate / 2).toFixed(2));
        cgstAmount = Number(((taxableAmount * cgstPercent) / 100).toFixed(2));
        sgstPercent = Number((effectiveGstRate / 2).toFixed(2));
        sgstAmount = Number(((taxableAmount * sgstPercent) / 100).toFixed(2));
      }
    }

    const rawTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount;
    const totalAmount = Math.round(rawTotal);
    const roundOff = Number((totalAmount - rawTotal).toFixed(2));
    const totalAmountWords = convertNumberToIndianWords(totalAmount);

    return {
      items: computedItems,
      subTotal,
      taxableAmount,
      gstRate: effectiveGstRate,
      cgstPercent,
      cgstAmount,
      sgstPercent,
      sgstAmount,
      igstPercent,
      igstAmount,
      roundOff,
      totalAmount,
      totalAmountWords,
    };
  }

  async findAll(query?: {
    customerId?: string;
    search?: string;
    status?: InvoiceStatus;
    paymentStatus?: PaymentStatus;
  }): Promise<InvoiceDocument[]> {
    const filter: Record<string, any> = {};

    if (query?.customerId) {
      if (Types.ObjectId.isValid(query.customerId)) {
        filter.customerId = {
          $in: [query.customerId, new Types.ObjectId(query.customerId)],
        };
      } else {
        filter.customerId = query.customerId;
      }
    }
    if (query?.status) {
      filter.status = query.status;
    }
    if (query?.paymentStatus) {
      filter.paymentStatus = query.paymentStatus;
    }
    if (query?.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [
        { invoiceNumber: regex },
        { vehicleNumber: regex },
        { 'customerSnapshot.companyName': regex },
        { 'customerSnapshot.customerCode': regex },
      ];
    }

    return this.invoiceModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<InvoiceDocument | null> {
    return this.invoiceModel.findById(id).exec();
  }

  async create(
    dto: CreateInvoiceDto,
    actorUser?: IUser,
  ): Promise<InvoiceDocument> {
    const customer = await this.customersService.findById(dto.customerId);
    if (!customer) {
      throw new NotFoundException('Customer record not found.');
    }

    const invoiceNumber = dto.invoiceNumber || (await this.getNextInvoiceNumber());

    // Detect Inter-State based on customer stateCode vs Maharashtra ('27')
    const customerStateCode = customer.billingAddress?.stateCode || '27';
    const isInterState =
      dto.isInterState !== undefined
        ? dto.isInterState
        : customerStateCode !== MILL_STATE_CODE;

    const totals = this.calculateTotals(
      dto.items,
      dto.transportCharges ?? 0,
      dto.hamaliCharges ?? 0,
      dto.discount ?? 0,
      isInterState,
      dto.invoiceType,
      dto.gstRate,
    );

    const company = await this.companyService.getCompanyDetails();
    const bankDetails: IInvoiceBankDetails = {
      bankName: company.bankDetails?.bankName || MILL_BANK_DETAILS.bankName,
      accountNo: company.bankDetails?.accountNumber || MILL_BANK_DETAILS.accountNo,
      ifsc: company.bankDetails?.ifsc || MILL_BANK_DETAILS.ifsc,
      branch: company.bankDetails?.branch || MILL_BANK_DETAILS.branch,
      upiId: company.bankDetails?.upiId || MILL_BANK_DETAILS.upiId,
    };
    const terms = company.termsAndConditions?.length
      ? company.termsAndConditions.join(' ')
      : '1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. will be charged if bill is not paid on due date. 3. Subject to Pune jurisdiction.';

    const newInvoice = new this.invoiceModel({
      invoiceNumber,
      invoiceType: dto.invoiceType,
      invoiceDate: new Date(dto.invoiceDate),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      customerId: customer._id.toString(),
      customerSnapshot: {
        customerCode: customer.customerCode,
        companyName: customer.companyName,
        contactPerson: customer.contactPerson,
        mobile: customer.mobile,
        email: customer.email,
        gstin: customer.gstin,
        billingAddress: customer.billingAddress,
      },
      reference: dto.reference?.trim(),
      vehicleNumber: dto.vehicleNumber?.toUpperCase().trim(),
      transportDetails: dto.transportDetails?.trim(),
      lrNumber: dto.lrNumber?.trim(),
      items: totals.items,
      subTotal: totals.subTotal,
      transportCharges: dto.transportCharges ?? 0,
      hamaliCharges: dto.hamaliCharges ?? 0,
      discount: dto.discount ?? 0,
      taxableAmount: totals.taxableAmount,
      isInterState,
      gstRate: totals.gstRate,
      cgstPercent: totals.cgstPercent,
      cgstAmount: totals.cgstAmount,
      sgstPercent: totals.sgstPercent,
      sgstAmount: totals.sgstAmount,
      igstPercent: totals.igstPercent,
      igstAmount: totals.igstAmount,
      roundOff: totals.roundOff,
      totalAmount: totals.totalAmount,
      totalAmountWords: totals.totalAmountWords,
      paymentStatus: PaymentStatus.UNPAID,
      paidAmount: 0,
      balanceAmount: totals.totalAmount,
      status: dto.status || InvoiceStatus.ISSUED,
      bankDetails,
      notes: dto.notes,
      terms,
      createdBy: actorUser?.id,
      issuedBy: actorUser?.name,
    });

    const saved = await newInvoice.save();

    // Update customer account balance
    await this.customersService.updateBalance(
      customer._id.toString(),
      totals.totalAmount,
      0,
    );

    if (actorUser) {
      await this.auditService.log({
        userId: actorUser.id,
        action: 'INVOICE_CREATE',
        module: 'INVOICING',
        performedBy: `${actorUser.name} (${actorUser.role})`,
        metadata: {
          invoiceId: saved._id.toString(),
          invoiceNumber: saved.invoiceNumber,
          customerName: customer.companyName,
          totalAmount: saved.totalAmount,
        },
      });
    }

    return saved;
  }

  async update(
    id: string,
    dto: UpdateInvoiceDto,
    actorUser?: IUser,
  ): Promise<InvoiceDocument> {
    const invoice = await this.findById(id);
    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    if (invoice.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException(
        'This invoice is fully paid and cannot be edited because payments are already settled.',
      );
    }

    const previousTotal = invoice.totalAmount;

    if (dto.invoiceType !== undefined) invoice.invoiceType = dto.invoiceType;
    if (dto.invoiceDate !== undefined) invoice.invoiceDate = new Date(dto.invoiceDate);
    if (dto.dueDate !== undefined) invoice.dueDate = new Date(dto.dueDate);
    if (dto.reference !== undefined) invoice.reference = dto.reference.trim();
    if (dto.vehicleNumber !== undefined) invoice.vehicleNumber = dto.vehicleNumber.toUpperCase().trim();
    if (dto.transportDetails !== undefined) invoice.transportDetails = dto.transportDetails.trim();
    if (dto.lrNumber !== undefined) invoice.lrNumber = dto.lrNumber.trim();
    if (dto.transportCharges !== undefined) invoice.transportCharges = dto.transportCharges;
    if (dto.hamaliCharges !== undefined) invoice.hamaliCharges = dto.hamaliCharges;
    if (dto.discount !== undefined) invoice.discount = dto.discount;
    if (dto.gstRate !== undefined) invoice.gstRate = dto.gstRate;
    if (dto.status !== undefined) invoice.status = dto.status;
    if (dto.notes !== undefined) invoice.notes = dto.notes;

    const items = dto.items || invoice.items;
    const isInterState =
      dto.isInterState !== undefined ? dto.isInterState : invoice.isInterState;
    const currentGstRate =
      dto.gstRate !== undefined ? dto.gstRate : invoice.gstRate;

    const totals = this.calculateTotals(
      items,
      invoice.transportCharges,
      invoice.hamaliCharges,
      invoice.discount,
      isInterState,
      invoice.invoiceType,
      currentGstRate,
    );

    if (totals.totalAmount < invoice.paidAmount) {
      throw new BadRequestException(
        `Cannot reduce invoice total to ₹${totals.totalAmount} because ₹${invoice.paidAmount} has already been paid against this invoice.`,
      );
    }

    invoice.items = totals.items;
    invoice.subTotal = totals.subTotal;
    invoice.taxableAmount = totals.taxableAmount;
    invoice.isInterState = isInterState;
    invoice.gstRate = totals.gstRate;
    invoice.cgstPercent = totals.cgstPercent;
    invoice.cgstAmount = totals.cgstAmount;
    invoice.sgstPercent = totals.sgstPercent;
    invoice.sgstAmount = totals.sgstAmount;
    invoice.igstPercent = totals.igstPercent;
    invoice.igstAmount = totals.igstAmount;
    invoice.roundOff = totals.roundOff;
    invoice.totalAmount = totals.totalAmount;
    invoice.totalAmountWords = totals.totalAmountWords;
    invoice.balanceAmount = Math.max(0, totals.totalAmount - invoice.paidAmount);

    if (invoice.paidAmount >= invoice.totalAmount) {
      invoice.paymentStatus = PaymentStatus.PAID;
    } else if (invoice.paidAmount > 0) {
      invoice.paymentStatus = PaymentStatus.PARTIAL;
    } else {
      invoice.paymentStatus = PaymentStatus.UNPAID;
    }

    const updated = await invoice.save();

    // Adjust customer balance by delta
    const delta = totals.totalAmount - previousTotal;
    if (delta !== 0) {
      await this.customersService.updateBalance(
        invoice.customerId,
        delta,
        0,
      );
    }

    if (actorUser) {
      await this.auditService.log({
        userId: actorUser.id,
        action: 'INVOICE_UPDATE',
        module: 'INVOICING',
        performedBy: `${actorUser.name} (${actorUser.role})`,
        metadata: {
          invoiceId: updated._id.toString(),
          invoiceNumber: updated.invoiceNumber,
          oldTotal: previousTotal,
          newTotal: updated.totalAmount,
        },
      });
    }

    return updated;
  }

  async recordPayment(
    invoiceId: string,
    dto: RecordPaymentDto,
    actorUser?: IUser,
  ): Promise<{ invoice: InvoiceDocument; receipt: PaymentReceiptDocument }> {
    const invoice = await this.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    const paymentAmount = Number(dto.amount.toFixed(2));
    const discountGiven = Number((dto.discount || 0).toFixed(2));

    if (paymentAmount + discountGiven <= 0) {
      throw new BadRequestException(
        'Payment amount or settlement discount must be greater than zero.',
      );
    }

    const currentBalance = Math.max(
      0,
      Number(
        (
          invoice.totalAmount -
          (invoice.paidAmount + (invoice.settlementDiscount || 0))
        ).toFixed(2),
      ),
    );

    if (paymentAmount + discountGiven > currentBalance + 0.05) {
      throw new BadRequestException(
        `Total settlement amount (₹${(paymentAmount + discountGiven).toFixed(2)}) exceeds current pending balance of ₹${currentBalance.toFixed(2)}.`,
      );
    }

    const count = await this.paymentReceiptModel.countDocuments().exec();
    const receiptNumber = `REC-${String(count + 1).padStart(4, '0')}`;

    const receipt = new this.paymentReceiptModel({
      receiptNumber,
      customerId: invoice.customerId,
      invoiceId: invoice._id.toString(),
      amount: paymentAmount,
      discountGiven,
      paymentDate: new Date(dto.paymentDate),
      paymentMode: dto.paymentMode,
      transactionReference: dto.transactionReference?.trim(),
      notes: dto.notes?.trim(),
      recordedBy: actorUser?.id,
    });

    const savedReceipt = await receipt.save();

    // Update invoice payment amounts and status
    invoice.paidAmount = Number((invoice.paidAmount + paymentAmount).toFixed(2));
    invoice.settlementDiscount = Number(
      ((invoice.settlementDiscount || 0) + discountGiven).toFixed(2)
    );
    invoice.balanceAmount = Math.max(
      0,
      Number(
        (
          invoice.totalAmount -
          (invoice.paidAmount + invoice.settlementDiscount)
        ).toFixed(2)
      )
    );

    if (invoice.balanceAmount === 0) {
      invoice.paymentStatus = PaymentStatus.PAID;
    } else if (invoice.paidAmount + invoice.settlementDiscount > 0) {
      invoice.paymentStatus = PaymentStatus.PARTIAL;
    } else {
      invoice.paymentStatus = PaymentStatus.UNPAID;
    }

    const updatedInvoice = await invoice.save();

    // Update customer balance (deltaPaid + deltaDiscount)
    await this.customersService.updateBalance(
      invoice.customerId,
      0,
      paymentAmount,
      discountGiven,
    );

    if (actorUser) {
      await this.auditService.log({
        userId: actorUser.id,
        action: 'INVOICE_PAYMENT_RECORD',
        module: 'INVOICING',
        performedBy: `${actorUser.name} (${actorUser.role})`,
        metadata: {
          invoiceId: invoice._id.toString(),
          receiptNumber: savedReceipt.receiptNumber,
          paidAmount: paymentAmount,
          discountGiven,
          remainingBalance: invoice.balanceAmount,
        },
      });
    }

    return { invoice: updatedInvoice, receipt: savedReceipt };
  }

  async allocateCustomerPayment(
    customerId: string,
    dto: RecordPaymentDto,
    actorUser?: IUser,
  ): Promise<{
    receipt: PaymentReceiptDocument;
    allocations: Array<{
      invoiceId: string;
      invoiceNumber: string;
      allocatedAmount: number;
      discountAmount?: number;
      previousBalance: number;
      newBalance: number;
      status: PaymentStatus;
    }>;
    totalDiscountsApplied: number;
    unallocatedAdvance: number;
    customer: CustomerDocument;
  }> {
    const customer = await this.customersService.findById(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const custIdFilter = Types.ObjectId.isValid(customerId)
      ? { $in: [customerId, new Types.ObjectId(customerId)] }
      : customerId;

    const pendingInvoices = await this.invoiceModel
      .find({
        customerId: custIdFilter as any,
        paymentStatus: { $in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
        status: { $ne: InvoiceStatus.CANCELLED },
      })
      .sort({ invoiceDate: 1, createdAt: 1 })
      .exec();

    // Build map of per-invoice discounts if passed
    const discountsMap = new Map<string, number>();
    if (Array.isArray(dto.discounts)) {
      for (const d of dto.discounts) {
        if (d && d.invoiceId && d.discount > 0) {
          const inv = pendingInvoices.find(
            (i) => i._id.toString() === d.invoiceId,
          );
          if (
            inv &&
            Number(d.discount.toFixed(2)) >
              Number(inv.balanceAmount.toFixed(2)) + 0.05
          ) {
            throw new BadRequestException(
              `Discount for invoice ${inv.invoiceNumber} (₹${d.discount.toFixed(2)}) exceeds current pending balance of ₹${inv.balanceAmount.toFixed(2)}.`,
            );
          }
          discountsMap.set(d.invoiceId, Number(d.discount.toFixed(2)));
        }
      }
    }

    let remainingPayment = Number(dto.amount.toFixed(2));
    if (remainingPayment <= 0 && discountsMap.size === 0) {
      throw new BadRequestException(
        'Payment amount or settlement discount must be greater than zero.',
      );
    }

    let totalDiscountsApplied = 0;
    const allocations: Array<{
      invoiceId: string;
      invoiceNumber: string;
      allocatedAmount: number;
      discountAmount?: number;
      previousBalance: number;
      newBalance: number;
      status: PaymentStatus;
    }> = [];

    for (const inv of pendingInvoices) {
      const invId = inv._id.toString();
      const prevBal = Number(inv.balanceAmount.toFixed(2));
      if (prevBal <= 0) continue;

      // Apply discount first if any
      const discountForInv = Number(
        Math.min(prevBal, discountsMap.get(invId) || 0).toFixed(2)
      );
      if (discountForInv > 0) {
        inv.settlementDiscount = Number(
          ((inv.settlementDiscount || 0) + discountForInv).toFixed(2)
        );
        totalDiscountsApplied = Number(
          (totalDiscountsApplied + discountForInv).toFixed(2)
        );
      }

      // Remaining due after discount for this bill
      const balanceAfterDiscount = Number(
        Math.max(0, prevBal - discountForInv).toFixed(2)
      );

      // Allocate from remaining lump-sum payment
      const allocated =
        remainingPayment > 0
          ? Number(Math.min(balanceAfterDiscount, remainingPayment).toFixed(2))
          : 0;

      if (allocated > 0) {
        inv.paidAmount = Number((inv.paidAmount + allocated).toFixed(2));
        remainingPayment = Number((remainingPayment - allocated).toFixed(2));
      }

      inv.balanceAmount = Number(
        Math.max(
          0,
          inv.totalAmount - (inv.paidAmount + (inv.settlementDiscount || 0))
        ).toFixed(2)
      );

      if (inv.balanceAmount === 0) {
        inv.paymentStatus = PaymentStatus.PAID;
      } else if (inv.paidAmount + (inv.settlementDiscount || 0) > 0) {
        inv.paymentStatus = PaymentStatus.PARTIAL;
      } else {
        inv.paymentStatus = PaymentStatus.UNPAID;
      }

      await inv.save();

      if (allocated > 0 || discountForInv > 0) {
        allocations.push({
          invoiceId: invId,
          invoiceNumber: inv.invoiceNumber,
          allocatedAmount: allocated,
          discountAmount: discountForInv > 0 ? discountForInv : undefined,
          previousBalance: prevBal,
          newBalance: inv.balanceAmount,
          status: inv.paymentStatus,
        });
      }
    }

    const count = await this.paymentReceiptModel.countDocuments().exec();
    const receiptNumber = `REC-${String(count + 1).padStart(4, '0')}`;

    const allocationSummary =
      allocations.length > 0
        ? `Allocated across ${allocations.length} bill(s): ` +
          allocations
            .map((a) => {
              let text = `${a.invoiceNumber} (₹${a.allocatedAmount.toFixed(2)})`;
              if (a.discountAmount && a.discountAmount > 0) {
                text += ` [Disc: ₹${a.discountAmount.toFixed(2)}]`;
              }
              return text;
            })
            .join(', ')
        : 'Advance deposit on account';

    const notes = dto.notes
      ? `${dto.notes.trim()} | ${allocationSummary}`
      : allocationSummary;

    const receipt = new this.paymentReceiptModel({
      receiptNumber,
      customerId: customer._id,
      amount: dto.amount,
      discountGiven: totalDiscountsApplied,
      paymentDate: new Date(dto.paymentDate),
      paymentMode: dto.paymentMode,
      transactionReference: dto.transactionReference?.trim(),
      notes,
      recordedBy: actorUser?.id,
    });

    const savedReceipt = await receipt.save();

    // Customer balance credited with total paid AND total discounts applied
    const updatedCustomer = await this.customersService.updateBalance(
      customer._id.toString(),
      0,
      dto.amount,
      totalDiscountsApplied,
    );

    if (actorUser) {
      await this.auditService.log({
        userId: actorUser.id,
        action: 'CUSTOMER_PAYMENT_ALLOCATED',
        module: 'INVOICING',
        performedBy: `${actorUser.name} (${actorUser.role})`,
        metadata: {
          customerId: customer._id.toString(),
          receiptNumber: savedReceipt.receiptNumber,
          totalAmount: dto.amount,
          totalDiscountsApplied,
          billsAllocatedCount: allocations.length,
          allocations,
          unallocatedAdvance: Math.max(0, remainingPayment),
        },
      });
    }

    return {
      receipt: savedReceipt,
      allocations,
      totalDiscountsApplied,
      unallocatedAdvance: Math.max(0, remainingPayment),
      customer: updatedCustomer || customer,
    };
  }

  async getCustomerLedger(customerId: string): Promise<ICustomerLedgerEntry[]> {
    const customer = await this.customersService.findById(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const custIdFilter = Types.ObjectId.isValid(customerId)
      ? { $in: [customerId, new Types.ObjectId(customerId)] }
      : customerId;

    const [invoices, receipts] = await Promise.all([
      this.invoiceModel
        .find({ customerId: custIdFilter as any, status: { $ne: InvoiceStatus.CANCELLED } })
        .sort({ invoiceDate: 1 })
        .exec(),
      this.paymentReceiptModel
        .find({ customerId: custIdFilter as any })
        .sort({ paymentDate: 1 })
        .exec(),
    ]);

    const entries: ICustomerLedgerEntry[] = [];

    // Opening balance entry if applicable
    if (customer.openingBalance > 0) {
      entries.push({
        id: 'OPENING',
        date: (customer as any).createdAt || new Date(),
        type: 'OPENING_BALANCE',
        referenceNo: 'OPEN-BAL',
        description: 'Account Opening Balance',
        debit: customer.openingBalance,
        credit: 0,
        runningBalance: customer.openingBalance,
      });
    }

    for (const inv of invoices) {
      entries.push({
        id: inv._id.toString(),
        date: inv.invoiceDate,
        type: 'INVOICE',
        referenceNo: inv.invoiceNumber,
        description: `Tax Bill (${inv.items.length} items - ${inv.vehicleNumber || 'Dispatch'})`,
        debit: inv.totalAmount,
        credit: 0,
        runningBalance: 0,
      });
    }

    for (const rec of receipts) {
      if (rec.amount > 0) {
        entries.push({
          id: rec._id.toString(),
          date: rec.paymentDate,
          type: 'PAYMENT',
          referenceNo: rec.receiptNumber,
          description: `Payment Received (${rec.paymentMode}${rec.transactionReference ? ' - ' + rec.transactionReference : ''})`,
          debit: 0,
          credit: rec.amount,
          runningBalance: 0,
        });
      }

      if (rec.discountGiven && rec.discountGiven > 0) {
        entries.push({
          id: `${rec._id.toString()}_disc`,
          date: rec.paymentDate,
          type: 'PAYMENT',
          referenceNo: `${rec.receiptNumber}-DISC`,
          description: `Settlement Discount / Waiver (${rec.receiptNumber})`,
          debit: 0,
          credit: rec.discountGiven,
          runningBalance: 0,
        });
      }
    }

    // Sort by date ascending
    entries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Calculate running balance
    let current = 0;
    for (const item of entries) {
      current = current + item.debit - item.credit;
      item.runningBalance = Number(current.toFixed(2));
    }

    return entries;
  }
}
