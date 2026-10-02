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
        bufferPages: true,
        info: {
          Title: `Invoice_${invoice.invoiceNumber}`,
          Author: 'Shree Laxminarayan Rice Mill',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const MAROON = '#800000';
      const BLACK = '#000000';
      const GRAY_TEXT = '#333333';
      const MUTED_TEXT = '#444444';

      const formatCurrency = (val: number | undefined | null) => {
        const num = val || 0;
        return new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);
      };

      // 1. Devotional Header
      doc
        .fontSize(7.5)
        .fillColor(GRAY_TEXT)
        .font('Helvetica-Oblique')
        .text(
          '|| Perantal Mata Prasana ||          || Shree Ganeshya Namha ||          || Shree Mukatai Prasana ||',
          30,
          28,
          { width: 535, align: 'center' },
        );

      // 2. Mill Header
      // Left: Title and contact
      doc
        .fontSize(15)
        .fillColor(MAROON)
        .font('Helvetica-Bold')
        .text('SHREE LAXMINARAYAN RICE MILL', 30, 44);

      doc
        .fontSize(7.8)
        .fillColor('#222222')
        .font('Helvetica')
        .text('Hivare Tarfe Narayangaon, Khodad Road, Tal:- Junnar, Dist:- Pune 410504', 30, 63);

      doc
        .fontSize(7.5)
        .fillColor('#222222')
        .font('Helvetica-Bold')
        .text('GSTIN: ', 30, 75, { continued: true })
        .font('Helvetica')
        .text('27ACHFS3445C1Z8          ', { continued: true })
        .font('Helvetica-Bold')
        .text('FSSAI: ', { continued: true })
        .font('Helvetica')
        .text('21526038000229');

      doc
        .fontSize(7.5)
        .fillColor('#222222')
        .font('Helvetica-Bold')
        .text('Mob: ', 30, 87, { continued: true })
        .font('Helvetica')
        .text('9960186123 / 9970901007          ', { continued: true })
        .font('Helvetica-Bold')
        .text('Email: ', { continued: true })
        .font('Helvetica')
        .text('slricemill@gmail.com');

      // Right: Copy Box
      const copyBoxX = 415;
      const copyBoxY = 44;
      const copyBoxW = 150;
      const copyBoxH = 49;
      doc.rect(copyBoxX, copyBoxY, copyBoxW, copyBoxH).stroke(BLACK);

      // Checkbox 1 (Original - checked)
      doc.rect(copyBoxX + 8, copyBoxY + 6, 8, 8).stroke(BLACK);
      doc.moveTo(copyBoxX + 10, copyBoxY + 8).lineTo(copyBoxX + 14, copyBoxY + 12).stroke(BLACK);
      doc.moveTo(copyBoxX + 14, copyBoxY + 8).lineTo(copyBoxX + 10, copyBoxY + 12).stroke(BLACK);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(BLACK).text('Original for Recipient', copyBoxX + 22, copyBoxY + 7);

      // Checkbox 2 (Duplicate)
      doc.rect(copyBoxX + 8, copyBoxY + 20, 8, 8).stroke(BLACK);
      doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT).text('Duplicate for transporter', copyBoxX + 22, copyBoxY + 21);

      // Checkbox 3 (Triplicate)
      doc.rect(copyBoxX + 8, copyBoxY + 34, 8, 8).stroke(BLACK);
      doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT).text('Triplicate for suppliers', copyBoxX + 22, copyBoxY + 35);

      // Maroon separator line under Mill Header
      doc.rect(30, 100, 535, 2).fill(MAROON);

      // 3. Tax Invoice Banner
      const bannerText =
        invoice.invoiceType === 'TAX_INVOICE'
          ? 'TAX INVOICE'
          : 'BILL INVOICE / DELIVERY CHALLAN';

      doc.rect(30, 108, 535, 20).fill(MAROON);
      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .text(bannerText, 30, 113, { align: 'center', width: 535 });

      // 4. Meta Box (Bill To & Invoice Details)
      const metaY = 134;

      const addrParts: string[] = [];
      if (invoice.customerSnapshot?.billingAddress?.line1) addrParts.push(invoice.customerSnapshot.billingAddress.line1);
      if (invoice.customerSnapshot?.billingAddress?.line2) addrParts.push(invoice.customerSnapshot.billingAddress.line2);
      const cityPin = `${invoice.customerSnapshot?.billingAddress?.city || 'Pune'} - ${invoice.customerSnapshot?.billingAddress?.pincode || '411033'}`;
      addrParts.push(cityPin);

      // Measure Bill To content height dynamically
      doc.fontSize(7.5).font('Helvetica');
      const addrHeight = doc.heightOfString(addrParts.join('\n'), { width: 255, lineGap: 1.5 });
      const calculatedBillToHeight = 7 + 11 + 13 + addrHeight + 4 + 11 + 11 + 6;
      const metaHeight = Math.max(86, calculatedBillToHeight);

      doc.rect(30, metaY, 535, metaHeight).stroke(BLACK);
      doc.moveTo(305, metaY).lineTo(305, metaY + metaHeight).stroke(BLACK);

      // Left: Bill To
      let billToY = metaY + 7;
      doc
        .fillColor('#222222')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Bill To:', 38, billToY);

      billToY += 11;
      doc
        .fillColor(BLACK)
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .text(invoice.customerSnapshot?.companyName || 'Cash Customer', 38, billToY, { width: 255 });

      billToY += 13;
      doc
        .fontSize(7.5)
        .font('Helvetica')
        .fillColor(GRAY_TEXT)
        .text(addrParts.join('\n'), 38, billToY, { width: 255, lineGap: 1.5 });

      billToY = doc.y + 4;
      doc
        .fontSize(7.5)
        .fillColor(BLACK)
        .font('Helvetica-Bold')
        .text('GSTIN: ', 38, billToY, { continued: true })
        .font('Helvetica')
        .text(invoice.customerSnapshot?.gstin || 'Unregistered');

      billToY += 11;
      doc
        .fontSize(7.5)
        .fillColor(BLACK)
        .font('Helvetica-Bold')
        .text('Mobile: ', 38, billToY, { continued: true })
        .font('Helvetica')
        .text(invoice.customerSnapshot?.mobile || '—');

      // Right: Specs Table
      const specs = [
        { label: 'Invoice No', value: invoice.invoiceNumber, bold: true },
        {
          label: 'Date',
          value: new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          bold: false,
        },
        { label: 'Reference', value: invoice.reference || '—', bold: false },
        { label: 'Transport Details', value: invoice.transportDetails || 'Direct Dispatch', bold: false },
        { label: 'Vehicle No', value: invoice.vehicleNumber || '—', bold: true },
      ];

      let specRowY = metaY + 1;
      const specRowH = 16.5;
      specs.forEach((s, idx) => {
        doc
          .fontSize(7.8)
          .fillColor(GRAY_TEXT)
          .font('Helvetica')
          .text(s.label, 313, specRowY + 4);

        doc
          .fontSize(7.8)
          .fillColor(BLACK)
          .font(s.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(s.value, 400, specRowY + 4, { width: 160 });

        if (idx < specs.length - 1) {
          doc.moveTo(305, specRowY + specRowH).lineTo(565, specRowY + specRowH).stroke('#EEEEEE');
        }
        specRowY += specRowH;
      });

      // 5. Items Table
      let tableY = metaY + metaHeight + 8;
      const colX = [30, 260, 325, 385, 455, 565]; // column border positions

      const drawTableHeader = (yPos: number) => {
        doc.rect(30, yPos, 535, 20).fillAndStroke('#F1F1F1', BLACK);
        for (let i = 1; i < colX.length - 1; i++) {
          doc.moveTo(colX[i], yPos).lineTo(colX[i], yPos + 20).stroke(BLACK);
        }

        doc
          .fillColor(BLACK)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text('Items Table / Description', colX[0] + 6, yPos + 5, { width: colX[1] - colX[0] - 12 })
          .text('HSN', colX[1], yPos + 5, { width: colX[2] - colX[1], align: 'center' })
          .text('Qty', colX[2], yPos + 5, { width: colX[3] - colX[2], align: 'center' })
          .text('Rate (Rs)', colX[3], yPos + 5, { width: colX[4] - colX[3] - 6, align: 'right' })
          .text('Amount (Rs)', colX[4], yPos + 5, { width: colX[5] - colX[4] - 8, align: 'right' });
      };

      drawTableHeader(tableY);

      let rowY = tableY + 20;
      for (const item of invoice.items) {
        const rowH = 20;
        if (rowY + rowH > 720) {
          doc.addPage();
          rowY = 30;
          drawTableHeader(rowY);
          rowY += 20;
        }

        doc.rect(30, rowY, 535, rowH).stroke(BLACK);
        for (let i = 1; i < colX.length - 1; i++) {
          doc.moveTo(colX[i], rowY).lineTo(colX[i], rowY + rowH).stroke(BLACK);
        }

        doc
          .fillColor(BLACK)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(item.description, colX[0] + 6, rowY + 5, { width: colX[1] - colX[0] - 12 })
          .font('Helvetica')
          .text(item.hsnCode, colX[1], rowY + 5, { width: colX[2] - colX[1], align: 'center' })
          .text(`${item.qty} ${item.unit}`, colX[2], rowY + 5, { width: colX[3] - colX[2], align: 'center' })
          .text(formatCurrency(item.rate), colX[3], rowY + 5, { width: colX[4] - colX[3] - 6, align: 'right' })
          .font('Helvetica-Bold')
          .text(formatCurrency(item.amount), colX[4], rowY + 5, { width: colX[5] - colX[4] - 8, align: 'right' });

        rowY += rowH;
      }

      // 6. Transport Summary Bar (if applicable)
      const transportTotal = (invoice.transportCharges || 0) + (invoice.hamaliCharges || 0);
      if (transportTotal > 0) {
        if (rowY + 24 > 740) {
          doc.addPage();
          rowY = 30;
        }
        rowY += 6;
        doc.rect(30, rowY, 535, 18).fillAndStroke('#F8F8F8', BLACK);
        doc
          .fillColor(BLACK)
          .fontSize(7.5)
          .font('Helvetica-Bold')
          .text('Transport & Handling Charges', 36, rowY + 5)
          .font('Helvetica')
          .text(`Freight: Rs.${formatCurrency(invoice.transportCharges)}`, 205, rowY + 5)
          .text(`Hamali / Loading: Rs.${formatCurrency(invoice.hamaliCharges)}`, 315, rowY + 5)
          .font('Helvetica-Bold')
          .text(`Total: Rs.${formatCurrency(transportTotal)}`, 450, rowY + 5, { width: 107, align: 'right' });
        rowY += 18;
      }

      // 7. Bank Details (Left) and Tax/Totals Box (Right)
      const totalsList: Array<{ label: string; value: string }> = [
        { label: 'Sub Total', value: `Rs.${formatCurrency(invoice.subTotal)}` },
      ];
      if (transportTotal > 0) {
        totalsList.push({ label: 'Transport & Handling', value: `Rs.${formatCurrency(transportTotal)}` });
      }
      if ((invoice.discount || 0) > 0) {
        totalsList.push({ label: 'Discount', value: `-Rs.${formatCurrency(invoice.discount)}` });
      }
      if (invoice.invoiceType === 'TAX_INVOICE') {
        if (invoice.isInterState) {
          totalsList.push({ label: 'IGST (5.0%)', value: `Rs.${formatCurrency(invoice.igstAmount)}` });
        } else {
          totalsList.push({ label: 'SGST (2.5%)', value: `Rs.${formatCurrency(invoice.sgstAmount)}` });
          totalsList.push({ label: 'CGST (2.5%)', value: `Rs.${formatCurrency(invoice.cgstAmount)}` });
        }
      }

      const boxHeight = Math.max(92, totalsList.length * 15 + 32);
      if (rowY + boxHeight + 8 > 740) {
        doc.addPage();
        rowY = 30;
      }

      const calcY = rowY + 8;
      doc.rect(30, calcY, 535, boxHeight).stroke(BLACK);
      doc.moveTo(295, calcY).lineTo(295, calcY + boxHeight).stroke(BLACK);

      // Bank Details
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(BLACK)
        .text('Bank Account Details (Supplier)', 38, calcY + 7);

      doc.moveTo(38, calcY + 18).lineTo(285, calcY + 18).stroke('#CCCCCC');

      const bankRows = [
        { label: 'Bank:', val: invoice.bankDetails?.bankName || 'HDFC Bank Ltd' },
        { label: 'A/C No:', val: invoice.bankDetails?.accountNo || '50200067891234' },
        { label: 'IFSC Code:', val: invoice.bankDetails?.ifsc || 'HDFC0001234' },
        { label: 'Branch:', val: invoice.bankDetails?.branch || 'Narayangaon Branch, Pune' },
        { label: 'UPI ID:', val: invoice.bankDetails?.upiId || 'slricemill@hdfcbank' },
      ];

      let bankY = calcY + 23;
      for (const b of bankRows) {
        doc
          .fontSize(7.5)
          .font('Helvetica-Bold')
          .fillColor('#222222')
          .text(b.label, 38, bankY, { width: 60 })
          .font('Helvetica')
          .fillColor(BLACK)
          .text(b.val, 100, bankY, { width: 185 });
        bankY += 12.5;
      }

      // Totals Table
      let totY = calcY + 7;
      for (const t of totalsList) {
        doc
          .fontSize(7.8)
          .font('Helvetica')
          .fillColor(GRAY_TEXT)
          .text(t.label, 305, totY)
          .font('Helvetica-Bold')
          .fillColor(BLACK)
          .text(t.value, 440, totY, { width: 117, align: 'right' });
        totY += 15;
      }

      // Divider above Grand Total
      doc.moveTo(295, totY + 2).lineTo(565, totY + 2).stroke(BLACK);

      // Grand Total row
      doc
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .fillColor(MAROON)
        .text('Total Amount', 305, totY + 7)
        .text(`Rs.${formatCurrency(invoice.totalAmount)}`, 440, totY + 7, { width: 117, align: 'right' });

      // 8. Amount in Words Box
      const wordsY = calcY + boxHeight + 8;
      doc.rect(30, wordsY, 535, 22).stroke(BLACK);
      doc
        .fillColor(BLACK)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Amount in Words: ', 38, wordsY + 6, { continued: true })
        .font('Helvetica')
        .text(invoice.totalAmountWords);

      // 9. Terms and Signatory Footer
      const footerY = wordsY + 22 + 14;
      doc
        .fontSize(7.5)
        .fillColor(BLACK)
        .font('Helvetica-Bold')
        .text('Terms & Conditions:', 30, footerY);

      doc
        .fontSize(7)
        .fillColor(MUTED_TEXT)
        .font('Helvetica')
        .text(
          '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if bill is not paid on due date.\n3. Subject to Pune jurisdiction.',
          30,
          footerY + 12,
          { lineGap: 2 },
        );

      doc
        .fontSize(7.8)
        .fillColor(BLACK)
        .font('Helvetica')
        .text('For Shree Laxminarayan Rice Mill', 380, footerY, { width: 185, align: 'center' });

      doc
        .fontSize(8)
        .fillColor(BLACK)
        .font('Helvetica-Bold')
        .text('Authorized Signature', 380, footerY + 45, { width: 185, align: 'center' });

      doc.end();
    });
  }

  generateCustomerStatementPdf(
    customer: any,
    ledgerEntries: any[],
    options: { startDate?: string; endDate?: string } = {},
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 28,
        bufferPages: true,
        info: {
          Title: `Statement_${customer?.customerCode || 'Customer'}`,
          Author: 'Shree Laxminarayan Rice Mill',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const PRIMARY_COLOR = '#0F172A';
      const SECONDARY_COLOR = '#0284C7';
      const BLACK = '#0F172A';
      const GRAY = '#475569';
      const LIGHT_BG = '#F8FAFC';
      const BORDER_COLOR = '#CBD5E1';

      const formatCurrency = (val: number | undefined | null) => {
        const num = val || 0;
        return new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);
      };

      const convertToWords = (amount: number): string => {
        if (isNaN(amount) || amount === 0) return 'Rupees Zero Only';
        const absAmount = Math.abs(amount);
        const integerPart = Math.floor(absAmount);
        const ones = [
          '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
          'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
          'Seventeen', 'Eighteen', 'Nineteen',
        ];
        const tens = [
          '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
        ];
        const twoDigits = (num: number) => {
          if (num < 20) return ones[num];
          const t = Math.floor(num / 10);
          const o = num % 10;
          return tens[t] + (o > 0 ? ' ' + ones[o] : '');
        };
        const threeDigits = (num: number) => {
          const h = Math.floor(num / 100);
          const rest = num % 100;
          let res = '';
          if (h > 0) res += ones[h] + ' Hundred';
          if (rest > 0) res += (res ? ' and ' : '') + twoDigits(rest);
          return res;
        };

        let remaining = integerPart;
        const crore = Math.floor(remaining / 10000000);
        remaining %= 10000000;
        const lakh = Math.floor(remaining / 100000);
        remaining %= 100000;
        const thousand = Math.floor(remaining / 1000);
        remaining %= 1000;
        const hundreds = remaining;

        const parts: string[] = [];
        if (crore > 0) parts.push(threeDigits(crore) + ' Crore');
        if (lakh > 0) parts.push(twoDigits(lakh) + ' Lakh');
        if (thousand > 0) parts.push(twoDigits(thousand) + ' Thousand');
        if (hundreds > 0) parts.push(threeDigits(hundreds));
        return 'Rupees ' + parts.join(' ') + ' Only';
      };

      // 1. Filter entries by date
      let startMs = 0;
      let endMs = Infinity;
      if (options.startDate) {
        startMs = new Date(`${options.startDate}T00:00:00`).getTime();
      }
      if (options.endDate) {
        endMs = new Date(`${options.endDate}T23:59:59.999`).getTime();
      }

      const priorEntries = ledgerEntries.filter(
        (e) => new Date(e.date).getTime() < startMs
      );
      const openingBalance =
        priorEntries.length > 0
          ? priorEntries[priorEntries.length - 1].runningBalance
          : customer?.openingBalance || 0;

      const periodEntries = ledgerEntries.filter((e) => {
        const t = new Date(e.date).getTime();
        return t >= startMs && t <= endMs;
      });

      let currentRunning = openingBalance;
      const statementEntries = periodEntries.map((e) => {
        currentRunning = Number(
          (currentRunning + (e.debit || 0) - (e.credit || 0)).toFixed(2)
        );
        return {
          ...e,
          statementRunningBalance: currentRunning,
        };
      });

      const totalDebit = Number(
        periodEntries.reduce((s, e) => s + (e.debit || 0), 0).toFixed(2)
      );
      const totalCredit = Number(
        periodEntries.reduce((s, e) => s + (e.credit || 0), 0).toFixed(2)
      );
      const closingBalance = currentRunning;
      const debitCount = periodEntries.filter((e) => (e.debit || 0) > 0).length;
      const creditCount = periodEntries.filter((e) => (e.credit || 0) > 0).length;

      // 2. Devotional Header
      doc
        .fontSize(7.5)
        .fillColor(GRAY)
        .font('Helvetica')
        .text(
          '|| Perantal Mata Prasanna ||          || Shree Ganeshay Namah ||          || Shree Mukatai Prasanna ||',
          28,
          26,
          { align: 'center', width: 539 }
        );

      // 3. Mill Header
      doc
        .fontSize(15)
        .fillColor(PRIMARY_COLOR)
        .font('Helvetica-Bold')
        .text('SHREE LAXMINARAYAN RICE MILL', 28, 42, { align: 'center', width: 539 });

      doc
        .fontSize(8)
        .fillColor(SECONDARY_COLOR)
        .font('Helvetica-Bold')
        .text('PRODUCERS, PROCESSORS & WHOLESALERS OF PREMIUM QUALITY RICE', 28, 60, {
          align: 'center',
          width: 539,
        });

      doc
        .fontSize(7.5)
        .fillColor(BLACK)
        .font('Helvetica')
        .text(
          'Hivare Tarfe Narayangaon, Khodad Road, Taluka Junnar, Dist: Pune — 410504, Maharashtra, India',
          28,
          72,
          { align: 'center', width: 539 }
        );

      doc.text(
        'GSTIN: 27ACHFS3445C1Z8   |   PAN: ACHFS3445C   |   FSSAI: 21526038000229   |   slricemill@gmail.com   |   Mob: +91 9960186123, +91 9970901007',
        28,
        83,
        { align: 'center', width: 539 }
      );

      // 4. Statement Banner
      const bannerY = 97;
      doc.rect(28, bannerY, 539, 22).fill(PRIMARY_COLOR);
      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text('STATEMENT OF ACCOUNT / KHATA PASSBOOK', 36, bannerY + 6, { width: 330 });

      const fromLabel = options.startDate
        ? new Date(options.startDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : 'Beginning';
      const toLabel = options.endDate
        ? new Date(options.endDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : 'Till Date';

      doc
        .fontSize(8)
        .font('Helvetica')
        .text(`Period: ${fromLabel} to ${toLabel}`, 340, bannerY + 6, {
          align: 'right',
          width: 220,
        });

      // 5. Account Holder & Statement Particulars
      const infoBoxY = 124;
      const boxHeight = 78;
      const colWidth = 266;

      // Customer Box (Left)
      doc.rect(28, infoBoxY, colWidth, boxHeight).stroke(BORDER_COLOR);
      doc.rect(28, infoBoxY, colWidth, 16).fill('#F1F5F9').stroke(BORDER_COLOR);
      doc
        .fillColor(PRIMARY_COLOR)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text('ACCOUNT HOLDER / CUSTOMER DETAILS', 34, infoBoxY + 4);

      doc
        .fillColor(BLACK)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(customer?.companyName || 'Valued Customer', 34, infoBoxY + 20, { width: 254 });

      doc
        .fontSize(7.5)
        .font('Helvetica')
        .text(
          `Customer ID: ${customer?.customerCode || '—'}   |   Contact: ${customer?.contactPerson || '—'}\nMobile: ${customer?.mobile || '—'}   |   Email: ${customer?.email || '—'}\nGSTIN: ${customer?.gstin || 'Unregistered Buyer'}\nAddress: ${customer?.billingAddress?.line1 || ''}, ${customer?.billingAddress?.city || ''} - ${customer?.billingAddress?.pincode || ''}, ${customer?.billingAddress?.state || ''}`,
          34,
          infoBoxY + 34,
          { width: 254, lineGap: 1.5 }
        );

      // Statement Particulars (Right)
      const rightBoxX = 28 + colWidth + 7;
      doc.rect(rightBoxX, infoBoxY, colWidth, boxHeight).stroke(BORDER_COLOR);
      doc.rect(rightBoxX, infoBoxY, colWidth, 16).fill('#F1F5F9').stroke(BORDER_COLOR);
      doc
        .fillColor(PRIMARY_COLOR)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text('STATEMENT PARTICULARS', rightBoxX + 6, infoBoxY + 4);

      const generatedOn = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      doc
        .fillColor(BLACK)
        .font('Helvetica')
        .fontSize(7.5)
        .text(
          `Statement Period: ${fromLabel} to ${toLabel}\nGenerated On: ${generatedOn} IST\nCurrency: Indian Rupee (INR ₹)\nAccount Status: ${customer?.isActive ? 'Active & In Good Standing' : 'Inactive'}\nTotal Invoices in Period: ${debitCount} Tax Invoices\nTotal Receipts in Period: ${creditCount} Payments`,
          rightBoxX + 6,
          infoBoxY + 20,
          { width: 254, lineGap: 1.5 }
        );

      // 6. 4-Box Summary Highlights
      const summaryY = 208;
      const cardW = 131;
      const cardH = 34;

      // Card 1: Opening
      doc.rect(28, summaryY, cardW, cardH).fill(LIGHT_BG).stroke(BORDER_COLOR);
      doc
        .fillColor(GRAY)
        .fontSize(6.5)
        .font('Helvetica-Bold')
        .text('OPENING BALANCE B/F', 34, summaryY + 5);
      doc
        .fillColor(PRIMARY_COLOR)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`Rs. ${formatCurrency(openingBalance)}`, 34, summaryY + 16);

      // Card 2: Debits
      doc.rect(28 + cardW + 5, summaryY, cardW, cardH).fill(LIGHT_BG).stroke(BORDER_COLOR);
      doc
        .fillColor(GRAY)
        .fontSize(6.5)
        .font('Helvetica-Bold')
        .text('TOTAL DEBITS (BILLED) (+)', 34 + cardW + 5, summaryY + 5);
      doc
        .fillColor('#0369A1')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`Rs. ${formatCurrency(totalDebit)}`, 34 + cardW + 5, summaryY + 16);

      // Card 3: Credits
      doc.rect(28 + (cardW + 5) * 2, summaryY, cardW, cardH).fill(LIGHT_BG).stroke(BORDER_COLOR);
      doc
        .fillColor(GRAY)
        .fontSize(6.5)
        .font('Helvetica-Bold')
        .text('TOTAL CREDITS (PAID) (-)', 34 + (cardW + 5) * 2, summaryY + 5);
      doc
        .fillColor('#047857')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`Rs. ${formatCurrency(totalCredit)}`, 34 + (cardW + 5) * 2, summaryY + 16);

      // Card 4: Closing
      doc.rect(28 + (cardW + 5) * 3, summaryY, cardW, cardH).fill('#EFF6FF').stroke('#93C5FD');
      doc
        .fillColor('#1E40AF')
        .fontSize(6.5)
        .font('Helvetica-Bold')
        .text('CLOSING BALANCE (=)', 34 + (cardW + 5) * 3, summaryY + 5);
      const balSuffix = closingBalance >= 0 ? 'Dr' : 'Cr';
      doc
        .fillColor(closingBalance >= 0 ? '#B91C1C' : '#047857')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`Rs. ${formatCurrency(Math.abs(closingBalance))} ${balSuffix}`, 34 + (cardW + 5) * 3, summaryY + 16);

      // 7. Statement Table
      let tableY = 249;

      const drawTableHeader = (y: number) => {
        doc.rect(28, y, 539, 18).fill('#0F172A');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
        doc.text('Date', 34, y + 5, { width: 55 });
        doc.text('Voucher / Ref #', 92, y + 5, { width: 85 });
        doc.text('Particulars / Narration', 180, y + 5, { width: 165 });
        doc.text('Type', 348, y + 5, { width: 45, align: 'center' });
        doc.text('Debit (Rs)', 396, y + 5, { width: 62, align: 'right' });
        doc.text('Credit (Rs)', 462, y + 5, { width: 52, align: 'right' });
        doc.text('Balance (Rs)', 514, y + 5, { width: 48, align: 'right' });
      };

      drawTableHeader(tableY);
      tableY += 18;

      // Opening Balance Row
      doc.rect(28, tableY, 539, 17).fill('#F8FAFC').stroke(BORDER_COLOR);
      doc.fillColor(BLACK).font('Helvetica').fontSize(7);
      doc.text(fromLabel, 34, tableY + 5, { width: 55 });
      doc.font('Helvetica-Bold').text('B/F', 92, tableY + 5, { width: 85 });
      doc.font('Helvetica').text('Opening Balance Brought Forward', 180, tableY + 5, { width: 165 });
      doc.text('OPENING', 348, tableY + 5, { width: 45, align: 'center' });
      doc.text('—', 396, tableY + 5, { width: 62, align: 'right' });
      doc.text('—', 462, tableY + 5, { width: 52, align: 'right' });
      doc.font('Helvetica-Bold').text(
        `${formatCurrency(Math.abs(openingBalance))} ${openingBalance >= 0 ? 'Dr' : 'Cr'}`,
        514,
        tableY + 5,
        { width: 48, align: 'right' }
      );
      tableY += 17;

      // Transaction Rows
      const rowHeight = 17;
      let rowIndex = 0;

      for (const item of statementEntries) {
        if (tableY + rowHeight > 750) {
          doc.addPage();
          tableY = 30;
          drawTableHeader(tableY);
          tableY += 18;
        }

        const bg = rowIndex % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
        doc.rect(28, tableY, 539, rowHeight).fill(bg).stroke(BORDER_COLOR);

        const dateStr = new Date(item.date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });

        doc.fillColor(BLACK).font('Helvetica').fontSize(7);
        doc.text(dateStr, 34, tableY + 5, { width: 55 });
        doc.font('Helvetica-Bold').text(item.referenceNo || '—', 92, tableY + 5, { width: 85 });
        doc.font('Helvetica').text(item.description || '—', 180, tableY + 5, { width: 165 });
        doc.text(item.type || 'TX', 348, tableY + 5, { width: 45, align: 'center' });

        if (item.debit > 0) {
          doc.fillColor('#0369A1').text(formatCurrency(item.debit), 396, tableY + 5, { width: 62, align: 'right' });
        } else {
          doc.fillColor(GRAY).text('—', 396, tableY + 5, { width: 62, align: 'right' });
        }

        if (item.credit > 0) {
          doc.fillColor('#047857').text(formatCurrency(item.credit), 462, tableY + 5, { width: 52, align: 'right' });
        } else {
          doc.fillColor(GRAY).text('—', 462, tableY + 5, { width: 52, align: 'right' });
        }

        const runBal = item.statementRunningBalance;
        const tag = runBal >= 0 ? 'Dr' : 'Cr';
        doc.fillColor(BLACK).font('Helvetica-Bold').text(
          `${formatCurrency(Math.abs(runBal))} ${tag}`,
          514,
          tableY + 5,
          { width: 48, align: 'right' }
        );

        tableY += rowHeight;
        rowIndex++;
      }

      // Empty State
      if (statementEntries.length === 0) {
        doc.rect(28, tableY, 539, 22).fill('#FFFFFF').stroke(BORDER_COLOR);
        doc
          .fillColor(GRAY)
          .font('Helvetica')
          .fontSize(8)
          .text(
            'No transactions recorded within the selected period.',
            28,
            tableY + 7,
            { align: 'center', width: 539 }
          );
        tableY += 22;
      }

      // Totals Footer Row
      if (tableY + 22 > 750) {
        doc.addPage();
        tableY = 30;
      }
      doc.rect(28, tableY, 539, 20).fill('#F1F5F9').stroke('#334155');
      doc
        .fillColor(PRIMARY_COLOR)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('Total Transactions in Selected Period', 34, tableY + 6, { width: 350 });

      doc
        .fillColor('#0369A1')
        .text(`Rs. ${formatCurrency(totalDebit)}`, 396, tableY + 6, { width: 62, align: 'right' });
      doc
        .fillColor('#047857')
        .text(`Rs. ${formatCurrency(totalCredit)}`, 462, tableY + 6, { width: 52, align: 'right' });
      doc
        .fillColor(PRIMARY_COLOR)
        .text(
          `Rs. ${formatCurrency(Math.abs(closingBalance))} ${closingBalance >= 0 ? 'Dr' : 'Cr'}`,
          514,
          tableY + 6,
          { width: 48, align: 'right' }
        );
      tableY += 24;

      // Words Box
      if (tableY + 24 > 750) {
        doc.addPage();
        tableY = 30;
      }
      doc.rect(28, tableY, 539, 20).stroke(BORDER_COLOR);
      const tagText = closingBalance >= 0 ? 'Debit / Receivable' : 'Credit / Advance';
      doc
        .fillColor(BLACK)
        .fontSize(7.5)
        .font('Helvetica-Bold')
        .text('Net Closing Balance in Words: ', 34, tableY + 6, { continued: true })
        .font('Helvetica')
        .text(`${convertToWords(closingBalance)} (${tagText})`);
      tableY += 26;

      // Signoff Section
      if (tableY + 90 > 750) {
        doc.addPage();
        tableY = 30;
      }
      doc
        .fontSize(7)
        .fillColor(GRAY)
        .font('Helvetica')
        .text(
          'Terms & Statement Declaration:\n1. This is an official computer-generated Statement of Account.\n2. Please examine this statement immediately upon receipt. Report any discrepancies within 7 days.\n3. All payments should be made strictly via A/C Payee Cheque / NEFT / RTGS to Shree Laxminarayan Rice Mill.',
          28,
          tableY,
          { width: 300, lineGap: 1.5 }
        );

      doc
        .fontSize(7.5)
        .fillColor(BLACK)
        .font('Helvetica-Bold')
        .text('Customer Seal & Signature', 345, tableY + 45, { align: 'center', width: 95 })
        .text('For Shree Laxminarayan Rice Mill', 445, tableY + 10, { align: 'center', width: 120 })
        .text('Authorized Signatory', 445, tableY + 45, { align: 'center', width: 120 });

      // Page numbers across all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(7)
          .fillColor(GRAY)
          .font('Helvetica')
          .text(
            `Page ${i + 1} of ${range.count}   |   Shree Laxminarayan Rice Mill ERP   |   Confidential`,
            28,
            792,
            { align: 'center', width: 539, lineBreak: false }
          );
      }

      doc.end();
    });
  }
}

