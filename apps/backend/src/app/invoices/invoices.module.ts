import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import {
  PaymentReceipt,
  PaymentReceiptSchema,
} from './schemas/payment-receipt.schema';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { CustomersModule } from '../customers/customers.module';
import { AuditModule } from '../common/audit/audit.module';

import { PdfGeneratorService } from './services/pdf-generator.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: PaymentReceipt.name, schema: PaymentReceiptSchema },
    ]),
    CustomersModule,
    AuditModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, PdfGeneratorService],
  exports: [InvoicesService, PdfGeneratorService],
})
export class InvoicesModule {}
