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
  Res,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CustomersService } from '../customers/customers.service';
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
    private readonly customersService: CustomersService,
  ) {}

  @Get(':id/pdf')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.VIEW_ONLY_ADMIN,
  )
  async downloadInvoicePdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.findById(id);
    const pdfBuffer = await this.pdfGeneratorService.generateInvoicePdf(invoice as any);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Invoice_${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });

    res.end(pdfBuffer);
  }

  @Get('next-number')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
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
    UserRole.VIEW_ONLY_ADMIN,
  )
  async getCustomerLedger(@Param('customerId') customerId: string) {
    const ledger = await this.invoicesService.getCustomerLedger(customerId);
    return {
      success: true,
      message: 'Customer Khata ledger retrieved successfully.',
      data: ledger,
    };
  }

  @Get('customer/:customerId/statement/pdf')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.VIEW_ONLY_ADMIN,
  )
  async downloadCustomerStatementPdf(
    @Param('customerId') customerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const customer = await this.customersService.findById(customerId);
    const ledger = await this.invoicesService.getCustomerLedger(customerId);
    const pdfBuffer = await this.pdfGeneratorService.generateCustomerStatementPdf(
      customer,
      ledger,
      { startDate, endDate },
    );

    const fromStr = (startDate || '').replace(/-/g, '');
    const toStr = (endDate || '').replace(/-/g, '');
    const filename = `Statement_${customer?.customerCode || 'Customer'}_${fromStr}_to_${toStr}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post('customer/:customerId/allocate-payment')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async allocateCustomerPayment(
    @Param('customerId') customerId: string,
    @Body() dto: RecordPaymentDto,
    @Req() req: { user?: IUser },
  ) {
    const result = await this.invoicesService.allocateCustomerPayment(
      customerId,
      dto,
      req?.user,
    );
    return {
      success: true,
      message: `Payment of ₹${dto.amount.toFixed(2)} successfully allocated across ${result.allocations.length} bill(s).`,
      data: result,
    };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.VIEW_ONLY_ADMIN,
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
    UserRole.VIEW_ONLY_ADMIN,
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
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
