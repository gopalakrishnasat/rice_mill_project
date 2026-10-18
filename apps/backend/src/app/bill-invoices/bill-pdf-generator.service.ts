import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';
import { BillInvoiceDocument } from './schemas/bill-invoice.schema';

@Injectable()
export class BillPdfGeneratorService {
  private resolveFontPath(fontFileName: string): string | null {
    const candidatePaths = [
      path.join(__dirname, 'assets/fonts', fontFileName),
      path.join(__dirname, '../assets/fonts', fontFileName),
      path.join(__dirname, '../../assets/fonts', fontFileName),
      path.join(process.cwd(), 'apps/backend/src/assets/fonts', fontFileName),
      path.join(process.cwd(), 'dist/apps/backend/assets/fonts', fontFileName),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  async generateBillPdf(bill: BillInvoiceDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        bufferPages: true,
        info: {
          Title: `Bill_Invoice_${bill.billNumber}`,
          Author: 'Rice Mill ERP',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Font Registration with Unicode support for ₹ symbol
      const regularFontPath = this.resolveFontPath('Roboto-Regular.ttf');
      const boldFontPath = this.resolveFontPath('Roboto-Bold.ttf');

      let regularFont = 'Helvetica';
      let boldFont = 'Helvetica-Bold';

      if (regularFontPath && boldFontPath) {
        doc.registerFont('AppFont', regularFontPath);
        doc.registerFont('AppFont-Bold', boldFontPath);
        regularFont = 'AppFont';
        boldFont = 'AppFont-Bold';
      }

      const formatCurrency = (val: number | undefined): string => {
        const num = val || 0;
        return new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);
      };

      const formatDate = (rawDate: any): string => {
        if (!rawDate) return '';
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return String(rawDate);
        return d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      };

      // Printable Geometry matching standard A4 dimensions & digital sheet proportions
      const startX = 42;
      const contentWidth = 511; // 595 - 84 pt (approx 15mm margins)
      const endX = startX + contentWidth;

      // 1. Centered Title: "BILL INVOICE"
      doc.font(boldFont).fontSize(16).fillColor('#111111');
      doc.text('BILL INVOICE', startX, 42, {
        width: contentWidth,
        align: 'center',
        characterSpacing: 1.2,
      });

      // Horizontal line below title
      doc.moveTo(startX, 66).lineTo(endX, 66).lineWidth(1).strokeColor('#111111').stroke();

      // 2. Outlined Two-Column Header Box
      const boxTop = 78;
      const midX = startX + contentWidth / 2;
      const leftColX = startX + 14;
      const leftColWidth = midX - leftColX - 14;

      const companyName = bill.customerSnapshot?.companyName || 'Cash Customer';
      const addressText = bill.customerSnapshot?.billingAddress || '';
      const mobileText = bill.customerSnapshot?.mobile || '';

      // Calculate required heights to dynamically expand the header box if address is lengthy
      doc.font(boldFont).fontSize(10);
      const nameH = doc.heightOfString(companyName, { width: leftColWidth });
      doc.font(regularFont).fontSize(8.5);
      const addrH = addressText ? doc.heightOfString(addressText, { width: leftColWidth, lineGap: 2.2 }) : 0;
      const mobileH = mobileText ? 14 : 0;
      const calculatedLeftHeight = 22 + nameH + 4 + addrH + (addrH ? 4 : 0) + mobileH + 16;
      const boxHeight = Math.max(105, calculatedLeftHeight);

      // Outer Box border
      doc.rect(startX, boxTop, contentWidth, boxHeight).lineWidth(1).strokeColor('#111111').stroke();
      // Vertical divider
      doc.moveTo(midX, boxTop).lineTo(midX, boxTop + boxHeight).lineWidth(1).strokeColor('#111111').stroke();

      // Left Column: Bill To
      let leftColY = boxTop + 10;
      doc.font(boldFont).fontSize(9.5).fillColor('#111111').text('Bill To:', leftColX, leftColY);
      leftColY += 15;

      doc.font(boldFont).fontSize(10.5).fillColor('#000000').text(companyName, leftColX, leftColY, {
        width: leftColWidth,
      });
      leftColY += nameH + 4;

      if (addressText) {
        doc.font(regularFont).fontSize(8.5).fillColor('#333333').text(addressText, leftColX, leftColY, {
          width: leftColWidth,
          lineGap: 2.2,
        });
        leftColY += addrH + 4;
      }

      if (mobileText) {
        doc.font(regularFont).fontSize(8.5).fillColor('#444444').text('Mobile: ', leftColX, leftColY, { continued: true });
        doc.font(boldFont).fillColor('#111111').text(mobileText);
      }

      // Right Column: Invoice Details
      const rightColX = midX + 14;
      let rightColY = boxTop + 10;
      doc.font(boldFont).fontSize(9.5).fillColor('#111111').text('Invoice Details:', rightColX, rightColY);
      rightColY += 16;

      const labelW = 72;
      // Invoice No
      doc.font(regularFont).fontSize(8.5).fillColor('#444444').text('Invoice No:', rightColX, rightColY, { width: labelW });
      doc.font(boldFont).fontSize(9).fillColor('#111111').text(bill.billNumber || '—', rightColX + labelW, rightColY);
      rightColY += 15;

      // Date
      doc.font(regularFont).fontSize(8.5).fillColor('#444444').text('Date:', rightColX, rightColY, { width: labelW });
      doc.font(boldFont).fontSize(9).fillColor('#111111').text(formatDate(bill.date), rightColX + labelW, rightColY);
      rightColY += 15;

      if (bill.vehicleNumber) {
        doc.font(regularFont).fontSize(8.5).fillColor('#444444').text('Vehicle No:', rightColX, rightColY, { width: labelW });
        doc.font(boldFont).fontSize(9).fillColor('#111111').text(bill.vehicleNumber, rightColX + labelW, rightColY);
      }

      // 3. Items Table
      let tableY = boxTop + boxHeight + 22;

      // Table Header lines (top & bottom borders of thead)
      doc.moveTo(startX, tableY).lineTo(endX, tableY).lineWidth(1).strokeColor('#111111').stroke();

      const thY = tableY + 6;
      doc.font(boldFont).fontSize(9).fillColor('#111111');
      doc.text('Description', startX + 6, thY, { width: 240, align: 'left' });
      doc.text('Qty', startX + 252, thY, { width: 80, align: 'left' });
      doc.text('Rate', startX + 338, thY, { width: 80, align: 'right' });
      doc.text('Amount', startX + 424, thY, { width: 81, align: 'right' });

      tableY += 22;
      doc.moveTo(startX, tableY).lineTo(endX, tableY).lineWidth(1).strokeColor('#111111').stroke();

      // Table Rows
      const items = bill.items || [];
      tableY += 8;

      for (const item of items) {
        const itemQtyStr = `${Number(item.quantity).toFixed(2)} ${item.unit || 'Bag'}`;
        const itemRateStr = formatCurrency(item.rate);
        const itemAmountStr = formatCurrency(item.amount);

        doc.font(regularFont).fontSize(9).fillColor('#111111');
        doc.text(item.description, startX + 6, tableY, { width: 240, align: 'left' });
        doc.text(itemQtyStr, startX + 252, tableY, { width: 80, align: 'left' });
        doc.text(itemRateStr, startX + 338, tableY, { width: 80, align: 'right' });
        doc.text(itemAmountStr, startX + 424, tableY, { width: 81, align: 'right' });

        tableY += 20;
      }

      // Table Bottom Line
      doc.moveTo(startX, tableY).lineTo(endX, tableY).lineWidth(1).strokeColor('#111111').stroke();

      // 4. Totals Box on Right
      const totalsBoxWidth = 200;
      const totalsBoxX = endX - totalsBoxWidth;
      const totalsBoxY = tableY + 22;
      const totalsBoxHeight = 54;

      // Totals Box Border
      doc.rect(totalsBoxX, totalsBoxY, totalsBoxWidth, totalsBoxHeight).lineWidth(1).strokeColor('#111111').stroke();

      // Sub Total Row
      const subTotalY = totalsBoxY + 8;
      doc.font(regularFont).fontSize(9).fillColor('#333333');
      doc.text('Sub Total', totalsBoxX + 12, subTotalY);
      doc.font(regularFont).fontSize(9).fillColor('#111111');
      doc.text(formatCurrency(bill.subTotal), totalsBoxX + 90, subTotalY, {
        width: totalsBoxWidth - 102,
        align: 'right',
      });

      // Inner divider line
      const innerLineY = totalsBoxY + 26;
      doc.moveTo(totalsBoxX, innerLineY).lineTo(totalsBoxX + totalsBoxWidth, innerLineY).lineWidth(0.8).strokeColor('#cccccc').stroke();

      // Total Row (with exact Unicode ₹ Rupee Symbol matching digital preview)
      const totalY = innerLineY + 7;
      doc.font(boldFont).fontSize(10.5).fillColor('#000000');
      doc.text('Total', totalsBoxX + 12, totalY);
      doc.text(`₹${formatCurrency(bill.totalAmount)}`, totalsBoxX + 70, totalY, {
        width: totalsBoxWidth - 82,
        align: 'right',
      });

      // 5. Authorized Signature
      const sigY = totalsBoxY + totalsBoxHeight + 52;
      const sigLineWidth = 150;
      const sigLineStart = endX - sigLineWidth;

      doc.moveTo(sigLineStart, sigY).lineTo(endX, sigY).lineWidth(1).strokeColor('#111111').stroke();
      doc.font(boldFont).fontSize(9).fillColor('#111111');
      doc.text('Authorized Signature', sigLineStart, sigY + 6, {
        width: sigLineWidth,
        align: 'center',
      });

      doc.end();
    });
  }
}
