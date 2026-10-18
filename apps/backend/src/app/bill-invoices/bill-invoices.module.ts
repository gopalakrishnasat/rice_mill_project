import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillInvoice, BillInvoiceSchema } from './schemas/bill-invoice.schema';
import { BillInvoicesService } from './bill-invoices.service';
import { BillPdfGeneratorService } from './bill-pdf-generator.service';
import { BillInvoicesController } from './bill-invoices.controller';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BillInvoice.name, schema: BillInvoiceSchema },
    ]),
    CustomersModule,
  ],
  controllers: [BillInvoicesController],
  providers: [BillInvoicesService, BillPdfGeneratorService],
  exports: [BillInvoicesService],
})
export class BillInvoicesModule {}
