import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { BillInvoicesService } from './bill-invoices.service';
import { BillPdfGeneratorService } from './bill-pdf-generator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  UserRole,
  IUser,
} from '@rice-mill-project/shared-types';
import { CreateBillInvoiceDto } from './dto/create-bill-invoice.dto';
import { UpdateBillInvoiceDto } from './dto/update-bill-invoice.dto';

@Controller('bill-invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillInvoicesController {
  constructor(
    private readonly billInvoicesService: BillInvoicesService,
    private readonly billPdfGeneratorService: BillPdfGeneratorService,
  ) {}

  @Get('next-number')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VIEW_ONLY_ADMIN)
  async getNextBillNumber() {
    const nextBillNumber = await this.billInvoicesService.getNextBillNumber();
    return {
      success: true,
      message: 'Next bill number generated',
      data: { nextBillNumber },
    };
  }

  @Get(':id/pdf')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VIEW_ONLY_ADMIN)
  async downloadBillPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const bill = await this.billInvoicesService.findById(id);
    if (!bill) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Bill invoice not found.',
      });
    }

    const pdfBuffer = await this.billPdfGeneratorService.generateBillPdf(bill);
    const cleanNumber = (bill.billNumber || 'BILL').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Bill_Invoice_${cleanNumber}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': pdfBuffer.length.toString(),
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });

    res.end(pdfBuffer);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VIEW_ONLY_ADMIN)
  async findById(@Param('id') id: string) {
    const bill = await this.billInvoicesService.findById(id);
    return {
      success: true,
      message: 'Bill invoice retrieved',
      data: bill,
    };
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VIEW_ONLY_ADMIN)
  async findAll(
    @Query('search') search?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const bills = await this.billInvoicesService.findAll({ search, customerId, startDate, endDate });
    return {
      success: true,
      message: 'Bill invoices retrieved',
      data: bills,
    };
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async create(
    @Body() dto: CreateBillInvoiceDto,
    @Req() req: { user?: IUser },
  ) {
    const bill = await this.billInvoicesService.create(dto, req.user?.id);
    return {
      success: true,
      message: 'Bill invoice created successfully',
      data: bill,
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBillInvoiceDto,
    @Req() req: { user?: IUser },
  ) {
    const bill = await this.billInvoicesService.update(id, dto, req.user?.id);
    return {
      success: true,
      message: 'Bill invoice updated successfully',
      data: bill,
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async delete(@Param('id') id: string) {
    const result = await this.billInvoicesService.delete(id);
    return result;
  }
}
