import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  UserRole,
  IUser,
  InvoiceStatus,
  PaymentStatus,
} from '@rice-mill-project/shared-types';

import { Response } from 'express';
import { PdfGeneratorService } from './services/pdf-generator.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {}

  @Get(':id/pdf')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.MANAGER,
    UserRole.STORE_MANAGER,
    UserRole.OPERATOR,
  )
  async downloadInvoicePdf(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const invoice = await this.invoicesService.findById(id);
    const pdfBuffer = await this.pdfGeneratorService.generateInvoicePdf(invoice as any);
    const res: Response = req.res;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Invoice_${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get('next-number')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTANT,
  )
  async getNextInvoiceNumber() {
    const nextNumber = await this.invoicesService.getNextInvoiceNumber();
    return {
      success: true,
      message: 'Next sequential invoice number generated successfully.',
      data: {
        nextInvoiceNumber: nextNumber,
      },
    };
  }

  @Get('customer/:customerId/ledger')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.MANAGER,
  )
  async getCustomerLedger(@Param('customerId') customerId: string) {
    const ledger = await this.invoicesService.getCustomerLedger(customerId);
    return {
      success: true,
      message: 'Customer Khata ledger retrieved successfully.',
      data: ledger,
    };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.MANAGER,
    UserRole.STORE_MANAGER,
    UserRole.OPERATOR,
  )
  async listInvoices(
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
    @Query('status') status?: InvoiceStatus,
    @Query('paymentStatus') paymentStatus?: PaymentStatus,
  ) {
    const invoices = await this.invoicesService.findAll({
      customerId,
      search,
      status,
      paymentStatus,
    });
    return {
      success: true,
      message: 'Invoices retrieved successfully.',
      data: invoices,
    };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.MANAGER,
    UserRole.STORE_MANAGER,
    UserRole.OPERATOR,
  )
  async getInvoiceById(@Param('id') id: string) {
    const invoice = await this.invoicesService.findById(id);
    return {
      success: true,
      message: 'Invoice details retrieved successfully.',
      data: invoice,
    };
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async createInvoice(
    @Body() createDto: CreateInvoiceDto,
    @Req() req: { user: IUser },
  ) {
    const invoice = await this.invoicesService.create(createDto, req.user);
    return {
      success: true,
      message: `Invoice ${invoice.invoiceNumber} created successfully.`,
      data: invoice,
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER)
  async updateInvoice(
    @Param('id') id: string,
    @Body() updateDto: UpdateInvoiceDto,
    @Req() req: { user: IUser },
  ) {
    const updated = await this.invoicesService.update(id, updateDto, req.user);
    return {
      success: true,
      message: `Invoice ${updated.invoiceNumber} updated successfully.`,
      data: updated,
    };
  }

  @Post(':id/payments')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.SALES_MANAGER,
  )
  async recordPayment(
    @Param('id') id: string,
    @Body() paymentDto: RecordPaymentDto,
    @Req() req: { user: IUser },
  ) {
    const result = await this.invoicesService.recordPayment(
      id,
      paymentDto,
      req.user,
    );
    return {
      success: true,
      message: `Payment of ₹${paymentDto.amount} recorded against invoice ${result.invoice.invoiceNumber}. Receipt ${result.receipt.receiptNumber} generated.`,
      data: result,
    };
  }
}
