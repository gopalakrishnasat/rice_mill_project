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
      doc.on('data', (data) => buffers.push(data));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const MAROON = '#800000';
      const BLACK = '#000000';
      const GRAY_TEXT = '#333333';
      const MUTED_TEXT = '#444444';

      const formatCurrency = (val: number | undefined): string => {
        const num = val || 0;
        return new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);
      };

      // 1. Devotional Header (Space-around 3 phrases)
      doc.fontSize(7.5).fillColor(GRAY_TEXT).font('Helvetica-Oblique');
      doc.text('|| Perantal Mata Prasana ||', 30, 26, { width: 178, align: 'center' });
      doc.text('|| Shree Ganeshya Namha ||', 208, 26, { width: 178, align: 'center' });
      doc.text('|| Shree Mukatai Prasana ||', 386, 26, { width: 178, align: 'center' });

      // 2. Mill Header
      const millY = 42;
      doc
        .fontSize(14.5)
        .fillColor(MAROON)
        .font('Helvetica-Bold')
        .text('SHREE LAXMINARAYAN RICE MILL', 30, millY);

      doc
        .fontSize(8)
        .fillColor('#222222')
        .font('Helvetica')
        .text('Hivare Tarfe Narayangaon, Khodad Road, Tal:- Junnar, Dist:- Pune 410504', 30, millY + 19);

      doc
        .fontSize(7.8)
        .fillColor('#222222')
        .font('Helvetica-Bold')
        .text('GSTIN: ', 30, millY + 31, { continued: true })
        .font('Helvetica')
        .text('27ACHFS3445C1Z8          ', { continued: true })
        .font('Helvetica-Bold')
        .text('FSSAI: ', { continued: true })
        .font('Helvetica')
        .text('21526038000229');

      doc
        .fontSize(7.8)
        .fillColor('#222222')
        .font('Helvetica-Bold')
        .text('Mob: ', 30, millY + 43, { continued: true })
        .font('Helvetica')
        .text('9960186123 / 9970901007          ', { continued: true })
        .font('Helvetica-Bold')
        .text('Email: ', { continued: true })
        .font('Helvetica')
        .text('slricemill@gmail.com');

      // Copy Box (Right side)
      const copyBoxX = 415;
      const copyBoxY = millY;
      const copyBoxW = 150;
      const copyBoxH = 50;
      doc.rect(copyBoxX, copyBoxY, copyBoxW, copyBoxH).lineWidth(1).stroke(BLACK);

      // Checkbox 1 (Original - checked with green/black checkmark)
      const cb1Y = copyBoxY + 6;
      doc.rect(copyBoxX + 8, cb1Y, 9, 9).lineWidth(1).stroke(BLACK);
      // Checkmark ✓
      doc
        .save()
        .lineWidth(1.2)
        .strokeColor(BLACK)
        .moveTo(copyBoxX + 9.5, cb1Y + 4.5)
        .lineTo(copyBoxX + 12, cb1Y + 7.5)
        .lineTo(copyBoxX + 16, cb1Y + 2)
        .stroke()
        .restore();
      doc.fontSize(7).font('Helvetica-Bold').fillColor(BLACK).text('Original for Recipient', copyBoxX + 22, cb1Y + 1);

      // Checkbox 2 (Duplicate)
      const cb2Y = copyBoxY + 20;
      doc.rect(copyBoxX + 8, cb2Y, 9, 9).lineWidth(0.8).stroke('#666666');
      doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT).text('Duplicate for transporter', copyBoxX + 22, cb2Y + 1);

      // Checkbox 3 (Triplicate)
      const cb3Y = copyBoxY + 34;
      doc.rect(copyBoxX + 8, cb3Y, 9, 9).lineWidth(0.8).stroke('#666666');
      doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT).text('Triplicate for suppliers', copyBoxX + 22, cb3Y + 1);

      // 2px Maroon separator line under Mill Header
      const sepY = copyBoxY + copyBoxH + 6;
      doc.rect(30, sepY, 535, 2).fill(MAROON);

      // 3. Tax Invoice Banner
      const bannerY = sepY + 6;
      const bannerH = 19;
      const bannerText =
        invoice.invoiceType === 'TAX_INVOICE'
          ? 'TAX INVOICE'
          : 'BILL INVOICE / DELIVERY CHALLAN';

      doc.rect(30, bannerY, 535, bannerH).fill(MAROON);
      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(bannerText, 30, bannerY + 4.5, { align: 'center', width: 535, characterSpacing: 1 });

      // 4. Meta Grid (Bill To & Invoice Details)
      const metaY = bannerY + bannerH + 6;
      const col1W = 535 * 0.55; // 294.25
      const col2W = 535 - col1W; // 240.75

      const addrLines: string[] = [];
      if (invoice.customerSnapshot?.billingAddress?.line1) addrLines.push(invoice.customerSnapshot.billingAddress.line1);
      if (invoice.customerSnapshot?.billingAddress?.line2) addrLines.push(invoice.customerSnapshot.billingAddress.line2);
      const cityPin = `${invoice.customerSnapshot?.billingAddress?.city || 'Pune'} - ${invoice.customerSnapshot?.billingAddress?.pincode || '411033'}`;
      addrLines.push(cityPin);

      // Calculate meta height based on content
      doc.fontSize(7.5).font('Helvetica');
      const addrHeight = doc.heightOfString(addrLines.join('\n'), { width: col1W - 16, lineGap: 1.2 });
      const calculatedBillToHeight = 7 + 10.5 + 12 + addrHeight + 3 + 10.5 + 10.5 + 8;
      const metaHeight = Math.max(88, calculatedBillToHeight);

      doc.rect(30, metaY, 535, metaHeight).lineWidth(1).stroke(BLACK);
      doc.moveTo(30 + col1W, metaY).lineTo(30 + col1W, metaY + metaHeight).lineWidth(1).stroke(BLACK);

      // Left: Bill To
      let bY = metaY + 7;
      doc.fillColor('#222222').fontSize(8).font('Helvetica-Bold').text('Bill To:', 38, bY);
      bY += 10.5;
      doc.fillColor(BLACK).fontSize(9.5).font('Helvetica-Bold').text(invoice.customerSnapshot?.companyName || 'Cash Customer', 38, bY, { width: col1W - 16 });
      bY += 12;
      doc.fontSize(7.5).font('Helvetica').fillColor(GRAY_TEXT).text(addrLines.join('\n'), 38, bY, { width: col1W - 16, lineGap: 1.2 });
      bY = doc.y + 3;
      if (invoice.customerSnapshot?.gstin) {
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(BLACK).text('GSTIN: ', 38, bY, { continued: true }).font('Helvetica').text(invoice.customerSnapshot.gstin);
        bY += 10.5;
      }
      if (invoice.customerSnapshot?.mobile) {
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(BLACK).text('Mobile: ', 38, bY, { continued: true }).font('Helvetica').text(invoice.customerSnapshot.mobile);
      }

      // Right: Specs Table
      const specs = [
        { label: 'Invoice No', value: invoice.invoiceNumber, bold: true },
        {
          label: 'Date',
          value: new Date(invoice.invoiceDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          bold: false,
        },
        { label: 'Reference', value: invoice.reference || '—', bold: false },
        { label: 'Transport Details', value: invoice.transportDetails || 'Direct Mill Truck Dispatch', bold: false },
        { label: 'Vehicle No', value: invoice.vehicleNumber || '—', bold: true },
      ];

      const specRowH = metaHeight / specs.length;
      let sY = metaY;
      specs.forEach((s, idx) => {
        doc.fontSize(7.8).font('Helvetica').fillColor(GRAY_TEXT).text(s.label, 30 + col1W + 10, sY + 5, { width: 85 });
        doc.fontSize(7.8).font(s.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(BLACK).text(s.value, 30 + col1W + 98, sY + 5, { width: col2W - 108 });
        if (idx < specs.length - 1) {
          doc.moveTo(30 + col1W, sY + specRowH).lineTo(565, sY + specRowH).lineWidth(0.5).stroke('#EEEEEE');
        }
        sY += specRowH;
      });

      // 5. Items Table
      let tableY = metaY + metaHeight + 6;
      // CSS: 45% (240.75), 15% (80.25), 12% (64.2), 13% (69.55), 15% (80.25)
      const itemColX = [30, 271, 351, 415, 485, 565];

      const drawTableHeader = (yPos: number) => {
        doc.rect(30, yPos, 535, 20).fillAndStroke('#F1F1F1', BLACK);
        for (let i = 1; i < itemColX.length - 1; i++) {
          doc.moveTo(itemColX[i], yPos).lineTo(itemColX[i], yPos + 20).lineWidth(1).stroke(BLACK);
        }

        doc
          .fillColor(BLACK)
          .fontSize(8.2)
          .font('Helvetica-Bold')
          .text('Items Table / Description', itemColX[0] + 6, yPos + 5.5, { width: itemColX[1] - itemColX[0] - 12 })
          .text('HSN', itemColX[1] + 6, yPos + 5.5, { width: itemColX[2] - itemColX[1] - 12 })
          .text('Qty', itemColX[2] + 6, yPos + 5.5, { width: itemColX[3] - itemColX[2] - 12 })
          .text('Rate (Rs)', itemColX[3], yPos + 5.5, { width: itemColX[4] - itemColX[3] - 6, align: 'right' })
          .text('Amount (Rs)', itemColX[4], yPos + 5.5, { width: itemColX[5] - itemColX[4] - 8, align: 'right' });
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

        doc.rect(30, rowY, 535, rowH).lineWidth(1).stroke(BLACK);
        for (let i = 1; i < itemColX.length - 1; i++) {
          doc.moveTo(itemColX[i], rowY).lineTo(itemColX[i], rowY + rowH).lineWidth(1).stroke(BLACK);
        }

        doc
          .fillColor(BLACK)
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(item.description, itemColX[0] + 6, rowY + 5.5, { width: itemColX[1] - itemColX[0] - 12 })
          .font('Helvetica')
          .text(item.hsnCode, itemColX[1] + 6, rowY + 5.5, { width: itemColX[2] - itemColX[1] - 12 })
          .text(`${item.qty} ${item.unit}`, itemColX[2] + 6, rowY + 5.5, { width: itemColX[3] - itemColX[2] - 12 })
          .text(formatCurrency(item.rate), itemColX[3], rowY + 5.5, { width: itemColX[4] - itemColX[3] - 6, align: 'right' })
          .font('Helvetica-Bold')
          .text(formatCurrency(item.amount), itemColX[4], rowY + 5.5, { width: itemColX[5] - itemColX[4] - 8, align: 'right' });

        rowY += rowH;
      }

      // 6. Transport Summary Bar
      const transportTotal = (invoice.transportCharges || 0) + (invoice.hamaliCharges || 0);
      if (transportTotal > 0) {
        if (rowY + 24 > 740) {
          doc.addPage();
          rowY = 30;
        }
        rowY += 6;
        doc.rect(30, rowY, 535, 18).lineWidth(1).fillAndStroke('#F8F8F8', BLACK);
        doc
          .fillColor(BLACK)
          .fontSize(7.8)
          .font('Helvetica-Bold')
          .text('Transport & Handling Charges', 36, rowY + 4.5, { width: 160 })
          .font('Helvetica')
          .text(`Freight: Rs. ${formatCurrency(invoice.transportCharges)}`, 200, rowY + 4.5)
          .text(`Hamali / Loading: Rs. ${formatCurrency(invoice.hamaliCharges)}`, 320, rowY + 4.5)
          .font('Helvetica-Bold')
          .text(`Total: Rs. ${formatCurrency(transportTotal)}`, 440, rowY + 4.5, { width: 117, align: 'right' });
        rowY += 18;
      }

      // 7. Calculation & Bank Box (50% / 50% Grid)
      const calcColW = 535 * 0.5; // 267.5pt
      const midX = 30 + calcColW; // 297.5

      const totalsList: Array<{ label: string; value: string }> = [
        { label: 'Sub Total', value: `Rs. ${formatCurrency(invoice.subTotal)}` },
      ];
      if (transportTotal > 0) {
        totalsList.push({ label: 'Transport & Handling', value: `Rs. ${formatCurrency(transportTotal)}` });
      }
      if ((invoice.discount || 0) > 0) {
        totalsList.push({ label: 'Discount', value: `-Rs. ${formatCurrency(invoice.discount)}` });
      }
      if (invoice.invoiceType === 'TAX_INVOICE') {
        if (invoice.isInterState) {
          totalsList.push({ label: 'IGST (5.0%)', value: `Rs. ${formatCurrency(invoice.igstAmount)}` });
        } else {
          totalsList.push({ label: 'SGST (2.5%)', value: `Rs. ${formatCurrency(invoice.sgstAmount)}` });
          totalsList.push({ label: 'CGST (2.5%)', value: `Rs. ${formatCurrency(invoice.cgstAmount)}` });
        }
      }

      const grandTotalRowH = 22;
      const totRowH = 15;
      const boxHeight = Math.max(95, totalsList.length * totRowH + grandTotalRowH + 12);

      if (rowY + boxHeight + 8 > 740) {
        doc.addPage();
        rowY = 30;
      }

      const calcY = rowY + 6;
      doc.rect(30, calcY, 535, boxHeight).lineWidth(1).stroke(BLACK);
      // Solid vertical divider at 50%
      doc.moveTo(midX, calcY).lineTo(midX, calcY + boxHeight).lineWidth(1).stroke(BLACK);

      // Left Side: Bank Account Details
      doc
        .fontSize(8.2)
        .font('Helvetica-Bold')
        .fillColor(BLACK)
        .text('Bank Account Details (Supplier)', 38, calcY + 7);

      doc.moveTo(38, calcY + 19).lineTo(midX - 12, calcY + 19).lineWidth(0.5).stroke('#CCCCCC');

      const bankRows = [
        { label: 'Bank:', val: invoice.bankDetails?.bankName || 'HDFC Bank Ltd' },
        { label: 'A/C No:', val: invoice.bankDetails?.accountNo || '50200067891234' },
        { label: 'IFSC Code:', val: invoice.bankDetails?.ifsc || 'HDFC0001234' },
        { label: 'Branch:', val: invoice.bankDetails?.branch || 'Narayangaon Branch, Pune' },
        { label: 'UPI ID:', val: invoice.bankDetails?.upiId || 'slricemill@hdfcbank' },
      ];

      let bankY = calcY + 24;
      for (const b of bankRows) {
        doc
          .fontSize(7.5)
          .font('Helvetica-Bold')
          .fillColor(BLACK)
          .text(b.label, 38, bankY, { continued: true })
          .font('Helvetica')
          .fillColor('#222222')
          .text(` ${b.val}`);
        bankY += 12.5;
      }

      // Right Side: Totals Table
      let totY = calcY + 7;
      for (const t of totalsList) {
        doc
          .fontSize(7.8)
          .font('Helvetica')
          .fillColor(GRAY_TEXT)
          .text(t.label, midX + 10, totY)
          .font('Helvetica-Bold')
          .fillColor(BLACK)
          .text(t.value, 440, totY, { width: 117, align: 'right' });
        totY += totRowH;
      }

      // Horizontal divider ONLY inside right box above Grand Total
      const grandDividerY = calcY + boxHeight - grandTotalRowH;
      doc.moveTo(midX, grandDividerY).lineTo(565, grandDividerY).lineWidth(1).stroke(BLACK);

      // Grand Total Row in Maroon
      doc
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .fillColor(MAROON)
        .text('Total Amount', midX + 10, grandDividerY + 6)
        .text(`Rs. ${formatCurrency(invoice.totalAmount)}`, 440, grandDividerY + 6, { width: 117, align: 'right' });

      // 8. Amount in Words Box
      const wordsY = calcY + boxHeight + 6;
      doc.rect(30, wordsY, 535, 20).lineWidth(1).stroke(BLACK);
      doc
        .fillColor(BLACK)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Amount in Words: ', 36, wordsY + 5.5, { continued: true })
        .font('Helvetica')
        .text(invoice.totalAmountWords);

      // 9. Terms and Conditions & Signatory Footer
      const footerY = wordsY + 20 + 12;
      doc
        .fontSize(7.8)
        .font('Helvetica-Bold')
        .fillColor(BLACK)
        .text('Terms & Conditions:', 30, footerY);

      doc
        .fontSize(7.2)
        .font('Helvetica')
        .fillColor(MUTED_TEXT)
        .text(
          '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if bill is not paid on due date.\n3. Subject to Pune jurisdiction.',
          30,
          footerY + 11,
          { lineGap: 2.2 }
        );

      doc
        .fontSize(7.8)
        .font('Helvetica')
        .fillColor(BLACK)
        .text('For Shree Laxminarayan Rice Mill', 380, footerY, { width: 185, align: 'center' });

      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(BLACK)
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

      const PRIMARY = '#0F172A';
      const SECONDARY = '#0284C7';
      const BORDER_LIGHT = '#CBD5E1';
      const BORDER_SUBTLE = '#E2E8F0';
      const BG_LIGHT = '#F8FAFC';
      const TEXT_DARK = '#0F172A';
      const TEXT_MUTED = '#64748B';
      const TEXT_BODY = '#334155';

      const formatCurrency = (val: number | undefined | null) => {
        const num = val || 0;
        return new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);
      };

      const formatStatementDate = (d: string | Date | undefined) => {
        if (!d) return '—';
        const dateObj =
          typeof d === 'string'
            ? new Date(d.includes('T') ? d : `${d}T00:00:00`)
            : d;
        if (isNaN(dateObj.getTime())) return String(d);
        return dateObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      };

      const formatStatementDateTime = (d: Date = new Date()) => {
        const dateStr = formatStatementDate(d);
        const hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'pm' : 'am';
        const h12 = hours % 12 || 12;
        return `${dateStr}, ${h12}:${minutes} ${ampm}`;
      };

      const sanitize = (str: any) => {
        if (!str) return '—';
        return String(str)
          .replace(/[\u2013\u2014]/g, '-')
          .replace(/[^\x20-\x7E]/g, '');
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

      // 1. Filter entries by date range
      let startMs = 0;
      let endMs = Infinity;
      if (options.startDate) {
        startMs = new Date(`${options.startDate}T00:00:00`).getTime();
      }
      if (options.endDate) {
        endMs = new Date(`${options.endDate}T23:59:59.999`).getTime();
      }

      const priorEntries = ledgerEntries.filter(
        (e) => new Date(e.date).getTime() < startMs,
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
          (currentRunning + (e.debit || 0) - (e.credit || 0)).toFixed(2),
        );
        return {
          ...e,
          statementRunningBalance: currentRunning,
        };
      });

      const totalDebit = Number(
        periodEntries.reduce((s, e) => s + (e.debit || 0), 0).toFixed(2),
      );
      const totalCredit = Number(
        periodEntries.reduce((s, e) => s + (e.credit || 0), 0).toFixed(2),
      );
      const closingBalance = currentRunning;
      const debitCount = periodEntries.filter((e) => (e.debit || 0) > 0).length;
      const creditCount = periodEntries.filter((e) => (e.credit || 0) > 0).length;

      const fromLabel = options.startDate
        ? formatStatementDate(options.startDate)
        : (periodEntries.length > 0 ? formatStatementDate(periodEntries[0].date) : 'Beginning');
      const toLabel = options.endDate
        ? formatStatementDate(options.endDate)
        : (periodEntries.length > 0 ? formatStatementDate(periodEntries[periodEntries.length - 1].date) : 'Till Date');
      const hyphenFromLabel = fromLabel.replace(/ /g, '-');
      const hyphenToLabel = toLabel.replace(/ /g, '-');
      const generatedOnTime = formatStatementDateTime();

      // 1. Devotional Header
      doc
        .fontSize(7)
        .fillColor(TEXT_MUTED)
        .font('Helvetica-Oblique')
        .text(
          '|| Perantal Mata Prasanna ||          || Shree Ganeshay Namah ||          || Shree Mukatai Prasanna ||',
          28,
          22,
          { align: 'center', width: 539 },
        );

      // Dotted line under devotional
      doc
        .save()
        .strokeColor(BORDER_LIGHT)
        .dash(2, { space: 3 })
        .moveTo(28, 33)
        .lineTo(567, 33)
        .stroke()
        .restore();

      // 2. Mill Logo & Brand Header
      const headerY = 38;
      const monoSize = 42;

      // Monogram Box (SLR)
      doc
        .save()
        .roundedRect(28, headerY, monoSize, monoSize, 6)
        .fill(PRIMARY)
        .restore();

      doc
        .fillColor('#F8FAFC')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('SLR', 28, headerY + 13, { width: monoSize, align: 'center' });

      // Brand Details on Right
      const brandX = 28 + monoSize + 10;

      doc
        .fontSize(13.5)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('SHREE LAXMINARAYAN RICE MILL', brandX, headerY - 1);

      doc
        .fontSize(7.5)
        .font('Helvetica-Bold')
        .fillColor(SECONDARY)
        .text(
          'PRODUCERS, PROCESSORS & WHOLESALERS OF PREMIUM QUALITY RICE',
          brandX,
          headerY + 15,
        );

      doc
        .fontSize(7.5)
        .font('Helvetica')
        .fillColor('#475569')
        .text(
          'Hivare Tarfe Narayangaon, Khodad Road, Taluka Junnar, Dist: Pune - 410504, Maharashtra, India',
          brandX,
          headerY + 26,
        );

      // Compliance row
      doc
        .fontSize(7.2)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('GSTIN: ', brandX, headerY + 37, { continued: true })
        .font('Helvetica')
        .text('27ACHFS3445C1Z8', { continued: true })
        .fillColor(TEXT_MUTED)
        .text('   •   ', { continued: true })
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .text('PAN: ', { continued: true })
        .font('Helvetica')
        .text('ACHFS3445C', { continued: true })
        .fillColor(TEXT_MUTED)
        .text('   •   ', { continued: true })
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .text('FSSAI: ', { continued: true })
        .font('Helvetica')
        .text('21526038000229');

      // Contact row
      doc
        .fontSize(7.2)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('Phone: ', brandX, headerY + 48, { continued: true })
        .font('Helvetica')
        .text('+91 9960186123, +91 9970901007', { continued: true })
        .fillColor(TEXT_MUTED)
        .text('   •   ', { continued: true })
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .text('Email: ', { continued: true })
        .font('Helvetica')
        .text('slricemill@gmail.com');

      // 3. Statement Document Banner
      const bannerY = headerY + 63;
      const bannerH = 26;
      doc
        .save()
        .roundedRect(28, bannerY, 539, bannerH, 4)
        .fill(PRIMARY)
        .restore();

      // Banner Left: Title & Subtitle
      doc
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .fillColor('#FFFFFF')
        .text('STATEMENT OF ACCOUNT / KHATA PASSBOOK', 36, bannerY + 5);

      doc
        .fontSize(6.8)
        .font('Helvetica')
        .fillColor('#94A3B8')
        .text('Customer Account Ledger & Transaction History', 36, bannerY + 16);

      // Banner Right: Period Badge
      doc
        .fontSize(6.5)
        .font('Helvetica-Bold')
        .fillColor('#38BDF8')
        .text('STATEMENT PERIOD', 350, bannerY + 5, { width: 209, align: 'right' });

      doc
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .fillColor('#FFFFFF')
        .text(`${fromLabel} to ${toLabel}`, 350, bannerY + 14, {
          width: 209,
          align: 'right',
        });

      // 4. Two-Column Info Cards
      const cardsY = bannerY + bannerH + 6;
      const cardW1 = 295;
      const cardW2 = 238;
      const cardGap = 6;
      const cardH = 92;

      // Card 1: Account Holder / Customer Details
      doc
        .save()
        .roundedRect(28, cardsY, cardW1, cardH, 4)
        .fillAndStroke('#FFFFFF', BORDER_LIGHT)
        .restore();

      // Card 1 Header Bar
      doc
        .save()
        .roundedRect(28, cardsY, cardW1, 15, 3)
        .fill('#F1F5F9')
        .restore();
      doc.rect(28, cardsY + 10, cardW1, 5).fill('#F1F5F9');
      doc.moveTo(28, cardsY + 15).lineTo(28 + cardW1, cardsY + 15).stroke(BORDER_LIGHT);

      doc
        .fontSize(6.8)
        .font('Helvetica-Bold')
        .fillColor('#334155')
        .text('ACCOUNT HOLDER / CUSTOMER DETAILS', 34, cardsY + 4);

      // Card 1 Body
      doc
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text(customer?.companyName || 'Valued Customer', 34, cardsY + 19);

      let rowY1 = cardsY + 31;
      const card1LabelW = 75;

      const drawCard1Row = (label: string, val: string, isCode = false) => {
        doc
          .fontSize(7.2)
          .font('Helvetica')
          .fillColor(TEXT_MUTED)
          .text(label, 34, rowY1, { width: card1LabelW });
        if (isCode) {
          doc
            .fontSize(7.2)
            .font('Courier-Bold')
            .fillColor(SECONDARY)
            .text(val, 34 + card1LabelW, rowY1);
        } else {
          doc
            .fontSize(7.2)
            .font('Helvetica-Bold')
            .fillColor(PRIMARY)
            .text(val, 34 + card1LabelW, rowY1);
        }
        rowY1 += 10;
      };

      drawCard1Row('Customer ID:', customer?.customerCode || '—', true);
      drawCard1Row('Contact Person:', customer?.contactPerson || '—');
      drawCard1Row('Mobile:', customer?.mobile || '—');
      drawCard1Row('Email:', customer?.email || '—');
      drawCard1Row('GSTIN:', customer?.gstin || 'Unregistered Buyer');

      // Address row
      const addrParts: string[] = [];
      if (customer?.billingAddress?.line1) addrParts.push(customer.billingAddress.line1);
      if (customer?.billingAddress?.line2) addrParts.push(customer.billingAddress.line2);
      const cityPin = [customer?.billingAddress?.city, customer?.billingAddress?.pincode]
        .filter(Boolean)
        .join(' - ');
      if (cityPin) addrParts.push(cityPin);
      if (customer?.billingAddress?.state) addrParts.push(customer.billingAddress.state);
      const fullAddress = addrParts.join(', ') || '—';

      doc
        .fontSize(7.2)
        .font('Helvetica')
        .fillColor(TEXT_MUTED)
        .text('Billing Address:', 34, rowY1, { width: card1LabelW });
      doc
        .fontSize(7.2)
        .font('Helvetica')
        .fillColor(TEXT_BODY)
        .text(fullAddress, 34 + card1LabelW, rowY1, {
          width: cardW1 - card1LabelW - 10,
          lineGap: 1.2,
        });

      // Card 2: Statement Particulars
      const card2X = 28 + cardW1 + cardGap;
      doc
        .save()
        .roundedRect(card2X, cardsY, cardW2, cardH, 4)
        .fillAndStroke('#FFFFFF', BORDER_LIGHT)
        .restore();

      // Card 2 Header Bar
      doc
        .save()
        .roundedRect(card2X, cardsY, cardW2, 15, 3)
        .fill('#F1F5F9')
        .restore();
      doc.rect(card2X, cardsY + 10, cardW2, 5).fill('#F1F5F9');
      doc.moveTo(card2X, cardsY + 15).lineTo(card2X + cardW2, cardsY + 15).stroke(BORDER_LIGHT);

      doc
        .fontSize(6.8)
        .font('Helvetica-Bold')
        .fillColor('#334155')
        .text('STATEMENT PARTICULARS', card2X + 8, cardsY + 4);

      // Card 2 Body
      let rowY2 = cardsY + 20;
      const card2LabelW = 95;

      const card2Rows = [
        { label: 'Statement Period:', val: `${hyphenFromLabel} to ${hyphenToLabel}`, bold: true },
        { label: 'Generated On:', val: `${generatedOnTime} IST`, bold: false },
        { label: 'Currency:', val: 'Indian Rupee (INR)', bold: false },
        {
          label: 'Account Status:',
          val: customer?.isActive ? 'Active & In Good Standing' : 'Inactive',
          bold: true,
          color: customer?.isActive ? '#047857' : '#B91C1C',
        },
        { label: 'Total Invoices in Period:', val: `${debitCount} Tax Invoices`, bold: false },
        { label: 'Total Payments in Period:', val: `${creditCount} Receipts`, bold: false },
      ];

      for (const r of card2Rows) {
        doc
          .fontSize(7.2)
          .font('Helvetica')
          .fillColor(TEXT_MUTED)
          .text(r.label, card2X + 8, rowY2, { width: card2LabelW });
        doc
          .fontSize(7.2)
          .font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(r.color || TEXT_DARK)
          .text(r.val, card2X + 8 + card2LabelW, rowY2, {
            width: cardW2 - card2LabelW - 12,
          });
        rowY2 += 11;
      }

      // 5. Bank-Style Summary Highlights Bar
      const sumY = cardsY + cardH + 6;
      const sumH = 38;
      const colW = 539 / 4;

      doc
        .save()
        .roundedRect(28, sumY, 539, sumH, 4)
        .fillAndStroke(BG_LIGHT, BORDER_LIGHT)
        .restore();

      // Soft blue background for 4th card (Closing)
      doc
        .save()
        .roundedRect(28 + colW * 3, sumY, colW, sumH, 4)
        .fill('#EFF6FF')
        .restore();
      doc.rect(28 + colW * 3, sumY, 5, sumH).fill('#EFF6FF');

      doc.moveTo(28 + colW, sumY).lineTo(28 + colW, sumY + sumH).stroke(BORDER_SUBTLE);
      doc.moveTo(28 + colW * 2, sumY).lineTo(28 + colW * 2, sumY + sumH).stroke(BORDER_SUBTLE);
      doc.moveTo(28 + colW * 3, sumY).lineTo(28 + colW * 3, sumY + sumH).stroke('#BFDBFE');

      doc
        .save()
        .roundedRect(28, sumY, 539, sumH, 4)
        .stroke(BORDER_LIGHT)
        .restore();

      // Cell 1: Opening
      doc
        .fontSize(6.3)
        .font('Helvetica-Bold')
        .fillColor(TEXT_MUTED)
        .text('OPENING BALANCE B/F', 34, sumY + 5);
      doc
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text(`Rs. ${formatCurrency(openingBalance)}`, 34, sumY + 15);
      doc
        .fontSize(6.2)
        .font('Helvetica')
        .fillColor(TEXT_MUTED)
        .text(`As of ${fromLabel}`, 34, sumY + 27);

      // Cell 2: Debits
      const c2X = 28 + colW + 6;
      doc
        .fontSize(6.3)
        .font('Helvetica-Bold')
        .fillColor(TEXT_MUTED)
        .text('TOTAL DEBITS (BILLED) (+)', c2X, sumY + 5);
      doc
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .fillColor(SECONDARY)
        .text(`Rs. ${formatCurrency(totalDebit)}`, c2X, sumY + 15);
      doc
        .fontSize(6.2)
        .font('Helvetica')
        .fillColor(TEXT_MUTED)
        .text(`${debitCount} Invoices/Charges`, c2X, sumY + 27);

      // Cell 3: Credits
      const c3X = 28 + colW * 2 + 6;
      doc
        .fontSize(6.3)
        .font('Helvetica-Bold')
        .fillColor(TEXT_MUTED)
        .text('TOTAL CREDITS (PAID) (-)', c3X, sumY + 5);
      doc
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .fillColor('#047857')
        .text(`Rs. ${formatCurrency(totalCredit)}`, c3X, sumY + 15);
      doc
        .fontSize(6.2)
        .font('Helvetica')
        .fillColor(TEXT_MUTED)
        .text(`${creditCount} Payments Received`, c3X, sumY + 27);

      // Cell 4: Closing
      const c4X = 28 + colW * 3 + 6;
      doc
        .fontSize(6.3)
        .font('Helvetica-Bold')
        .fillColor('#1E40AF')
        .text('CLOSING NET BALANCE (=)', c4X, sumY + 5);
      doc
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .fillColor(closingBalance >= 0 ? '#B91C1C' : '#047857')
        .text(`Rs. ${formatCurrency(Math.abs(closingBalance))}`, c4X, sumY + 15);
      const closeNote =
        closingBalance > 0
          ? 'Dr (Receivable from Buyer)'
          : closingBalance < 0
          ? 'Cr (Advance Paid)'
          : 'Nil Balance';
      doc
        .fontSize(6.2)
        .font('Helvetica-Bold')
        .fillColor('#1E40AF')
        .text(closeNote, c4X, sumY + 27);

      // 6. Transaction Passbook Table
      let tableY = sumY + sumH + 8;
      const colX = [28, 86, 161, 326, 374, 432, 490, 567]; // total 539

      const drawTableHeader = (y: number) => {
        doc.rect(28, y, 539, 18).fill(PRIMARY);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7);
        doc.text('Date', colX[0] + 5, y + 5);
        doc.text('Voucher / Ref #', colX[1] + 5, y + 5);
        doc.text('Particulars / Narration', colX[2] + 5, y + 5);
        doc.text('Type', colX[3], y + 5, {
          width: colX[4] - colX[3],
          align: 'center',
        });
        doc.text('Debit (Rs)', colX[4], y + 5, {
          width: colX[5] - colX[4] - 5,
          align: 'right',
        });
        doc.text('Credit (Rs)', colX[5], y + 5, {
          width: colX[6] - colX[5] - 5,
          align: 'right',
        });
        doc.text('Balance (Rs)', colX[6], y + 5, {
          width: colX[7] - colX[6] - 6,
          align: 'right',
        });
      };

      drawTableHeader(tableY);
      tableY += 18;

      // Opening Balance Row
      const opRowH = 21;
      doc.rect(28, tableY, 539, opRowH).fillAndStroke('#F8FAFC', BORDER_LIGHT);
      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor('#475569')
        .text(fromLabel, colX[0] + 5, tableY + 5);
      doc.font('Courier-Bold').fillColor(SECONDARY).text('B/F', colX[1] + 5, tableY + 5);

      doc
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('Opening Balance Brought Forward', colX[2] + 5, tableY + 3);
      doc
        .font('Helvetica')
        .fontSize(6.2)
        .fillColor(TEXT_MUTED)
        .text(
          'Balance carried over from prior statement period',
          colX[2] + 5,
          tableY + 12,
        );

      const pillY = tableY + 5;
      doc
        .save()
        .roundedRect(colX[3] + 4, pillY, 38, 11, 2)
        .fillAndStroke('#F1F5F9', '#E2E8F0')
        .restore();
      doc
        .fontSize(6)
        .font('Helvetica-Bold')
        .fillColor('#475569')
        .text('OPENING', colX[3] + 4, pillY + 2.5, { width: 38, align: 'center' });

      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor(TEXT_MUTED)
        .text('—', colX[4], tableY + 6, {
          width: colX[5] - colX[4] - 5,
          align: 'right',
        });
      doc.text('—', colX[5], tableY + 6, {
        width: colX[6] - colX[5] - 5,
        align: 'right',
      });

      doc
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text(formatCurrency(Math.abs(openingBalance)), colX[6], tableY + 6, {
          width: colX[7] - colX[6] - 18,
          align: 'right',
        });
      doc
        .font('Helvetica')
        .fontSize(6.2)
        .fillColor(TEXT_MUTED)
        .text(openingBalance >= 0 ? 'Dr' : 'Cr', colX[7] - 16, tableY + 6.5);

      tableY += opRowH;

      // Data rows with pagination check
      let runningBal = openingBalance;
      let rowIndex = 0;

      for (const e of statementEntries) {
        runningBal = e.statementRunningBalance;
        const rowH = 17.5;

        if (tableY + rowH > 770) {
          doc.addPage();
          tableY = 32;
          drawTableHeader(tableY);
          tableY += 18;
        }

        const isPayment = e.type === 'PAYMENT';
        const rowBg = isPayment
          ? '#FAFAF9'
          : rowIndex % 2 === 0
          ? '#FAFBFC'
          : '#FFFFFF';
        doc.rect(28, tableY, 539, rowH).fill(rowBg);
        doc
          .moveTo(28, tableY + rowH)
          .lineTo(567, tableY + rowH)
          .stroke(BORDER_SUBTLE);

        // Date
        const rowDate = formatStatementDate(e.date);
        doc
          .fontSize(7)
          .font('Helvetica')
          .fillColor('#475569')
          .text(rowDate, colX[0] + 5, tableY + 5);

        // Ref badge
        doc
          .font('Courier-Bold')
          .fillColor(SECONDARY)
          .text(sanitize(e.referenceNo), colX[1] + 5, tableY + 5);

        // Narration
        doc
          .font('Helvetica')
          .fillColor(TEXT_BODY)
          .text(sanitize(e.description), colX[2] + 5, tableY + 5, {
            width: colX[3] - colX[2] - 8,
            height: 13,
            ellipsis: true,
          });

        // Type Pill
        const pY = tableY + 3.5;
        const pW = 38;
        const pX = colX[3] + (colX[4] - colX[3] - pW) / 2;
        if (isPayment) {
          doc
            .save()
            .roundedRect(pX, pY, pW, 10.5, 2)
            .fillAndStroke('#ECFDF5', '#A7F3D0')
            .restore();
          doc
            .fontSize(5.8)
            .font('Helvetica-Bold')
            .fillColor('#047857')
            .text('PAYMENT', pX, pY + 2.5, { width: pW, align: 'center' });
        } else {
          doc
            .save()
            .roundedRect(pX, pY, pW, 10.5, 2)
            .fillAndStroke('#E0F2FE', '#BAE6FD')
            .restore();
          doc
            .fontSize(5.8)
            .font('Helvetica-Bold')
            .fillColor('#0369A1')
            .text('INVOICE', pX, pY + 2.5, { width: pW, align: 'center' });
        }

        // Debit
        if (e.debit > 0) {
          doc
            .fontSize(7)
            .font('Helvetica-Bold')
            .fillColor(PRIMARY)
            .text(formatCurrency(e.debit), colX[4], tableY + 5, {
              width: colX[5] - colX[4] - 5,
              align: 'right',
            });
        } else {
          doc
            .fontSize(7)
            .font('Helvetica')
            .fillColor(TEXT_MUTED)
            .text('—', colX[4], tableY + 5, {
              width: colX[5] - colX[4] - 5,
              align: 'right',
            });
        }

        // Credit
        if (e.credit > 0) {
          doc
            .fontSize(7)
            .font('Helvetica-Bold')
            .fillColor('#047857')
            .text(formatCurrency(e.credit), colX[5], tableY + 5, {
              width: colX[6] - colX[5] - 5,
              align: 'right',
            });
        } else {
          doc
            .fontSize(7)
            .font('Helvetica')
            .fillColor(TEXT_MUTED)
            .text('—', colX[5], tableY + 5, {
              width: colX[6] - colX[5] - 5,
              align: 'right',
            });
        }

        // Balance
        doc
          .fontSize(7)
          .font('Helvetica-Bold')
          .fillColor(PRIMARY)
          .text(formatCurrency(Math.abs(runningBal)), colX[6], tableY + 5, {
            width: colX[7] - colX[6] - 18,
            align: 'right',
          });
        doc
          .fontSize(6.2)
          .font('Helvetica')
          .fillColor(TEXT_MUTED)
          .text(runningBal >= 0 ? 'Dr' : 'Cr', colX[7] - 16, tableY + 5.5);

        tableY += rowH;
        rowIndex++;
      }

      // Empty State
      if (statementEntries.length === 0) {
        doc.rect(28, tableY, 539, 22).fill('#FFFFFF').stroke(BORDER_LIGHT);
        doc
          .fillColor(TEXT_MUTED)
          .font('Helvetica')
          .fontSize(7.5)
          .text(
            `No transactions recorded within the selected period (${fromLabel} to ${toLabel}).`,
            28,
            tableY + 7,
            { align: 'center', width: 539 },
          );
        tableY += 22;
      }

      // Table Period Totals Footer
      const totH = 19;
      if (tableY + totH > 770) {
        doc.addPage();
        tableY = 32;
      }

      doc.rect(28, tableY, 539, totH).fill('#F1F5F9');
      doc.moveTo(28, tableY).lineTo(567, tableY).lineWidth(1.5).stroke(PRIMARY);
      doc.moveTo(28, tableY + totH).lineTo(567, tableY + totH).lineWidth(1.5).stroke(PRIMARY);
      doc.lineWidth(1);

      doc
        .fontSize(7.2)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('Total Transactions in Selected Period', 28, tableY + 5, {
          width: colX[4] - 35,
          align: 'right',
        });

      doc
        .fontSize(7.2)
        .font('Helvetica-Bold')
        .fillColor(SECONDARY)
        .text(`Rs. ${formatCurrency(totalDebit)}`, colX[4] - 5, tableY + 5, {
          width: colX[5] - colX[4] + 5,
          align: 'right',
        });

      doc
        .fontSize(7.2)
        .font('Helvetica-Bold')
        .fillColor('#047857')
        .text(`Rs. ${formatCurrency(totalCredit)}`, colX[5] - 5, tableY + 5, {
          width: colX[6] - colX[5] + 5,
          align: 'right',
        });

      doc
        .fontSize(7.2)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text(
          `Rs. ${formatCurrency(Math.abs(closingBalance))} ${closingBalance >= 0 ? 'Dr' : 'Cr'}`,
          colX[6] - 15,
          tableY + 5,
          { width: colX[7] - colX[6] + 12, align: 'right' },
        );

      tableY += totH + 8;

      // 7. Net Closing Balance in Words Box
      const wordsH = 20;
      if (tableY + wordsH > 770) {
        doc.addPage();
        tableY = 32;
      }

      doc
        .save()
        .dash(3, { space: 2 })
        .roundedRect(28, tableY, 539, wordsH, 4)
        .fillAndStroke(BG_LIGHT, BORDER_LIGHT)
        .restore();

      const tagText =
        closingBalance >= 0 ? 'Debit / Receivable' : 'Credit / Advance';
      doc
        .fontSize(7.2)
        .font('Helvetica-Bold')
        .fillColor(TEXT_MUTED)
        .text('Net Closing Balance in Words: ', 34, tableY + 5, { continued: true })
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text(`${convertToWords(closingBalance)} (${tagText})`);

      tableY += wordsH + 6;

      // 8. End of Statement Delimiter
      if (tableY + 12 > 770) {
        doc.addPage();
        tableY = 32;
      }
      doc
        .fontSize(6.5)
        .font('Helvetica-Bold')
        .fillColor('#94A3B8')
        .text('* * * END OF STATEMENT * * *', 28, tableY, {
          align: 'center',
          width: 539,
        });

      tableY += 12;

      // 9. Notes & Signatures Section (2 Columns)
      const signBoxH = 68;
      const termsW = 285;
      const sigsW = 539 - termsW - 10;
      const sigX = 28 + termsW + 10;

      if (tableY + signBoxH > 770) {
        doc.addPage();
        tableY = 32;
      }

      // Left: Terms & Declaration Box
      doc
        .save()
        .roundedRect(28, tableY, termsW, signBoxH, 4)
        .fillAndStroke('#FFFFFF', BORDER_SUBTLE)
        .restore();

      doc
        .fontSize(6.8)
        .font('Helvetica-Bold')
        .fillColor('#334155')
        .text('TERMS & STATEMENT DECLARATION:', 34, tableY + 6);

      doc
        .fontSize(6.5)
        .font('Helvetica')
        .fillColor('#475569')
        .text(
          '1. This is a computer-generated official Statement of Accounts and Khata Ledger.\n2. Please examine this statement immediately upon receipt. If any discrepancy or missing entry is noticed, kindly notify Shree Laxminarayan Rice Mill within 7 days.\n3. All payments must be made strictly through Account Payee Cheque / NEFT / RTGS payable to SHREE LAXMINARAYAN RICE MILL.',
          34,
          tableY + 17,
          { width: termsW - 14, lineGap: 2.2 },
        );

      // Right: 2 Signature Boxes (Customer Sig & Mill Sig)
      const singleSigW = (sigsW - 8) / 2;

      // Sig Box 1: Customer
      doc
        .save()
        .dash(3, { space: 2 })
        .roundedRect(sigX, tableY, singleSigW, signBoxH, 4)
        .stroke(BORDER_LIGHT)
        .restore();

      doc
        .fontSize(6.5)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('Customer Seal & Signature', sigX, tableY + signBoxH - 20, {
          width: singleSigW,
          align: 'center',
        });
      doc
        .fontSize(5.8)
        .font('Helvetica')
        .fillColor(TEXT_MUTED)
        .text('Accepted & Confirmed', sigX, tableY + signBoxH - 10, {
          width: singleSigW,
          align: 'center',
        });

      // Sig Box 2: Mill
      doc
        .save()
        .dash(3, { space: 2 })
        .roundedRect(sigX + singleSigW + 8, tableY, singleSigW, signBoxH, 4)
        .stroke(BORDER_LIGHT)
        .restore();

      doc
        .fontSize(6.2)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text(
          'For SHREE LAXMINARAYAN RICE MILL',
          sigX + singleSigW + 8,
          tableY + signBoxH - 20,
          { width: singleSigW, align: 'center' },
        );
      doc
        .fontSize(5.8)
        .font('Helvetica')
        .fillColor(TEXT_MUTED)
        .text(
          'Authorized Signatory',
          sigX + singleSigW + 8,
          tableY + signBoxH - 10,
          { width: singleSigW, align: 'center' },
        );

      // 10. Document Print Footer on Every Page
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .save()
          .strokeColor(BORDER_LIGHT)
          .dash(1, { space: 2 })
          .moveTo(28, 792)
          .lineTo(567, 792)
          .stroke()
          .restore();

        doc
          .fontSize(6.5)
          .font('Helvetica')
          .fillColor(TEXT_MUTED)
          .text(`Page ${i + 1} of ${range.count}`, 28, 796, {
            width: 100,
            lineBreak: false,
          });

        doc.text(
          `Generated by Shree Laxminarayan Rice Mill ERP on ${generatedOnTime}`,
          200,
          796,
          { width: 367, align: 'right', lineBreak: false },
        );
      }

      doc.end();
    });
  }
}

