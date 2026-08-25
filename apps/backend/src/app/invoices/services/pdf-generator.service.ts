import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { InvoiceDocument } from '../schemas/invoice.schema';

@Injectable()
export class PdfGeneratorService {
  generateInvoicePdf(invoice: InvoiceDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 30,
        info: {
          Title: `Invoice ${invoice.invoiceNumber}`,
          Author: 'Shree Laxminarayan Rice Mill',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const MAROON = '#800000';
      const BLACK = '#000000';
      const GRAY = '#555555';

      // 1. Devotional Header
      doc
        .fontSize(8)
        .fillColor(GRAY)
        .text(
          '|| Perantal Mata Prasana ||          || Shree Ganeshya Namha ||          || Shree Mukatai Prasana ||',
          { align: 'center' },
        );
      doc.moveDown(0.5);

      // 2. Mill Header
      doc
        .fontSize(16)
        .fillColor(MAROON)
        .font('Helvetica-Bold')
        .text('SHREE LAXMINARAYAN RICE MILL', { align: 'center' });

      doc
        .fontSize(8)
        .fillColor(BLACK)
        .font('Helvetica')
        .text(
          'Hivare Tarfe Narayangaon, Khodad Road, Tal:- Junnar, Dist:- Pune 410504',
          { align: 'center' },
        );

      doc.text(
        'GSTIN: 27ACHFS3445C1Z8  |  FSSAI: 21526038000229  |  Slricemill@gmail.com  |  Mob: 9960186123 / 9970901007',
        { align: 'center' },
      );
      doc.moveDown(0.4);

      // 3. Maroon Banner
      const bannerText =
        invoice.invoiceType === 'TAX_INVOICE'
          ? 'TAX INVOICE'
          : 'BILL INVOICE / DELIVERY CHALLAN';

      const bannerY = doc.y;
      doc.rect(30, bannerY, 535, 20).fill(MAROON);
      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(bannerText, 30, bannerY + 4, { align: 'center', width: 535 });

      doc.moveDown(1.2);

      // 4. Meta Box (Bill To & Invoice Details)
      const metaY = doc.y;
      doc.rect(30, metaY, 535, 80).stroke(BLACK);
      doc.moveTo(310, metaY).lineTo(310, metaY + 80).stroke(BLACK);

      // Left Column: Bill To
      doc
        .fillColor(BLACK)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Bill To:', 38, metaY + 8);

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(invoice.customerSnapshot?.companyName || 'Cash Customer', 38, metaY + 20);

      doc
        .fontSize(8)
        .font('Helvetica')
        .text(
          `${invoice.customerSnapshot?.billingAddress?.line1 || ''}\n${invoice.customerSnapshot?.billingAddress?.city || 'Pune'} - ${invoice.customerSnapshot?.billingAddress?.pincode || '411033'}\nGSTIN: ${invoice.customerSnapshot?.gstin || 'Unregistered'} | Mob: ${invoice.customerSnapshot?.mobile || '—'}`,
          38,
          metaY + 34,
          { width: 260 },
        );

      // Right Column: Invoice Specs
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(`Invoice No:`, 320, metaY + 8)
        .font('Helvetica')
        .text(invoice.invoiceNumber, 400, metaY + 8);

      doc
        .font('Helvetica-Bold')
        .text(`Date:`, 320, metaY + 22)
        .font('Helvetica')
        .text(
          new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          400,
          metaY + 22,
        );

      doc
        .font('Helvetica-Bold')
        .text(`Reference:`, 320, metaY + 36)
        .font('Helvetica')
        .text(invoice.reference || '—', 400, metaY + 36);

      doc
        .font('Helvetica-Bold')
        .text(`Vehicle No:`, 320, metaY + 50)
        .font('Helvetica')
        .text(invoice.vehicleNumber || '—', 400, metaY + 50);

      doc
        .font('Helvetica-Bold')
        .text(`Transport:`, 320, metaY + 64)
        .font('Helvetica')
        .text(invoice.transportDetails || 'Direct Dispatch', 400, metaY + 64);

      // 5. Items Table
      const tableY = metaY + 90;
      doc.rect(30, tableY, 535, 20).fill('#F0F0F0').stroke(BLACK);

      doc
        .fillColor(BLACK)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Items Description', 35, tableY + 5)
        .text('HSN Code', 260, tableY + 5)
        .text('Qty', 350, tableY + 5)
        .text('Rate (Rs)', 410, tableY + 5)
        .text('Amount (Rs)', 485, tableY + 5);

      let rowY = tableY + 20;
      for (const item of invoice.items) {
        doc.rect(30, rowY, 535, 20).stroke(BLACK);
        doc
          .fillColor(BLACK)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(item.description, 35, rowY + 5, { width: 220 })
          .font('Helvetica')
          .text(item.hsnCode, 260, rowY + 5)
          .text(`${item.qty} ${item.unit}`, 350, rowY + 5)
          .text(item.rate.toFixed(2), 410, rowY + 5)
          .font('Helvetica-Bold')
          .text(item.amount.toFixed(2), 485, rowY + 5);
        rowY += 20;
      }

      // 6. Transport Summary Bar (if applicable)
      const transportTotal =
        (invoice.transportCharges || 0) + (invoice.hamaliCharges || 0);
      if (transportTotal > 0) {
        doc.rect(30, rowY, 535, 18).fill('#FAFAFA').stroke(BLACK);
        doc
          .fillColor(BLACK)
          .fontSize(8)
          .font('Helvetica')
          .text(
            `Transport & Handling Summary: Freight Rs.${invoice.transportCharges || 0}  |  Hamali Rs.${invoice.hamaliCharges || 0}`,
            35,
            rowY + 4,
          )
          .font('Helvetica-Bold')
          .text(`Rs.${transportTotal.toFixed(2)}`, 485, rowY + 4);
        rowY += 18;
      }

      // 7. Bank Details (Left) and Tax/Totals Box (Right)
      const totalsY = rowY + 5;
      doc.rect(30, totalsY, 535, 100).stroke(BLACK);
      doc.moveTo(310, totalsY).lineTo(310, totalsY + 100).stroke(BLACK);

      // Bank Details
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Bank Account Details (Supplier)', 38, totalsY + 8)
        .font('Helvetica')
        .text(`Bank Name: ${invoice.bankDetails?.bankName || 'HDFC Bank Ltd'}`, 38, totalsY + 22)
        .text(`A/C Number: ${invoice.bankDetails?.accountNo || '50200067891234'}`, 38, totalsY + 36)
        .text(`IFSC Code: ${invoice.bankDetails?.ifsc || 'HDFC0001234'}`, 38, totalsY + 50)
        .text(`Branch: ${invoice.bankDetails?.branch || 'Narayangaon, Pune'}`, 38, totalsY + 64)
        .text(`UPI ID: ${invoice.bankDetails?.upiId || 'slricemill@hdfcbank'}`, 38, totalsY + 78);

      // Totals & GST
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Sub Total:', 320, totalsY + 8)
        .font('Helvetica')
        .text(`Rs.${invoice.subTotal.toFixed(2)}`, 485, totalsY + 8);

      if (transportTotal > 0) {
        doc
          .font('Helvetica-Bold')
          .text('Transport & Hamali:', 320, totalsY + 22)
          .font('Helvetica')
          .text(`Rs.${transportTotal.toFixed(2)}`, 485, totalsY + 22);
      }

      if (invoice.invoiceType === 'TAX_INVOICE') {
        if (invoice.isInterState) {
          doc
            .font('Helvetica-Bold')
            .text('IGST (5.0%):', 320, totalsY + 36)
            .font('Helvetica')
            .text(`Rs.${invoice.igstAmount.toFixed(2)}`, 485, totalsY + 36);
        } else {
          doc
            .font('Helvetica-Bold')
            .text('SGST (2.5%):', 320, totalsY + 36)
            .font('Helvetica')
            .text(`Rs.${invoice.sgstAmount.toFixed(2)}`, 485, totalsY + 36);

          doc
            .font('Helvetica-Bold')
            .text('CGST (2.5%):', 320, totalsY + 50)
            .font('Helvetica')
            .text(`Rs.${invoice.cgstAmount.toFixed(2)}`, 485, totalsY + 50);
        }
      }

      doc.moveTo(310, totalsY + 70).lineTo(565, totalsY + 70).stroke(BLACK);
      doc
        .fillColor(MAROON)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Grand Total:', 320, totalsY + 78)
        .text(`Rs.${invoice.totalAmount.toFixed(2)}`, 475, totalsY + 78);

      // 8. Amount in Words Box
      const wordsY = totalsY + 105;
      doc.rect(30, wordsY, 535, 22).stroke(BLACK);
      doc
        .fillColor(BLACK)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(`Amount in Words: `, 38, wordsY + 6, { continued: true })
        .font('Helvetica')
        .text(invoice.totalAmountWords);

      // 9. Terms & Signatures
      const footerY = wordsY + 35;
      doc
        .fontSize(7)
        .fillColor(GRAY)
        .text(
          'Terms & Conditions:\n1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if bill is not paid on due date.\n3. Subject to Pune jurisdiction.',
          30,
          footerY,
          { width: 300 },
        );

      doc
        .fontSize(8)
        .fillColor(BLACK)
        .font('Helvetica-Bold')
        .text('For Shree Laxminarayan Rice Mill', 380, footerY)
        .moveDown(2)
        .text('Authorized Signatory', 420, footerY + 35);

      doc.end();
    });
  }
}
