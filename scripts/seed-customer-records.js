const mongoose = require('mongoose');

const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const tens = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function numToWordsUnderThousand(num) {
  let str = '';
  if (num >= 100) {
    str += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num >= 20) {
    str += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  }
  if (num > 0) {
    str += ones[num] + ' ';
  }
  return str.trim();
}

function convertNumberToIndianWords(amount) {
  if (isNaN(amount) || amount === 0) return 'Rupees Zero Only';

  const parts = amount.toFixed(2).split('.');
  let num = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);

  let words = '';

  if (num >= 10000000) {
    const crore = Math.floor(num / 10000000);
    words += numToWordsUnderThousand(crore) + ' Crore ';
    num %= 10000000;
  }

  if (num >= 100000) {
    const lakh = Math.floor(num / 100000);
    words += numToWordsUnderThousand(lakh) + ' Lakh ';
    num %= 100000;
  }

  if (num >= 1000) {
    const thousand = Math.floor(num / 1000);
    words += numToWordsUnderThousand(thousand) + ' Thousand ';
    num %= 1000;
  }

  if (num > 0) {
    words += numToWordsUnderThousand(num) + ' ';
  }

  words = words.trim();
  let result = `Rupees ${words}`;

  if (paise > 0) {
    result += ` and Paise ${numToWordsUnderThousand(paise)}`;
  }

  return `${result} Only`.replace(/\s+/g, ' ');
}

function calculateInvoiceTotals(items, transportCharges = 0, hamaliCharges = 0, discount = 0, isInterState = false) {
  let subTotal = 0;
  const computedItems = items.map((item) => {
    const amount = Number((item.qty * item.rate).toFixed(2));
    subTotal += amount;
    return { ...item, amount };
  });

  subTotal = Number(subTotal.toFixed(2));
  const taxableAmount = Number(
    Math.max(0, subTotal + transportCharges + hamaliCharges - discount).toFixed(2)
  );

  let cgstPercent = 0;
  let cgstAmount = 0;
  let sgstPercent = 0;
  let sgstAmount = 0;
  let igstPercent = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstPercent = 5.0;
    igstAmount = Number(((taxableAmount * igstPercent) / 100).toFixed(2));
  } else {
    cgstPercent = 2.5;
    cgstAmount = Number(((taxableAmount * cgstPercent) / 100).toFixed(2));
    sgstPercent = 2.5;
    sgstAmount = Number(((taxableAmount * sgstPercent) / 100).toFixed(2));
  }

  const rawTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount;
  const totalAmount = Math.round(rawTotal);
  const roundOff = Number((totalAmount - rawTotal).toFixed(2));
  const totalAmountWords = convertNumberToIndianWords(totalAmount);

  return {
    items: computedItems,
    subTotal,
    taxableAmount,
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

const MILL_BANK_DETAILS = {
  bankName: 'HDFC Bank Ltd',
  accountNo: '50200067891234',
  ifsc: 'HDFC0001234',
  branch: 'Narayangaon Branch, Pune',
  upiId: 'slricemill@hdfcbank',
};

async function seedCustomerRecords() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rice_mill_erp';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const { ObjectId } = mongoose.Types;

  const targetCustomerId = '6a8c72cd4a1ab201071749b4';
  const customer = await db.collection('customers').findOne({ _id: new ObjectId(targetCustomerId) });

  if (!customer) {
    console.error(`Customer with ID ${targetCustomerId} not found!`);
    await mongoose.disconnect();
    return;
  }

  console.log(`Found Customer: ${customer.companyName} (${customer.customerCode})`);
  console.log(`Current Balance: ₹${customer.currentBalance}, Billed: ₹${customer.totalBilled}, Paid: ₹${customer.totalPaid}`);

  // Find latest invoice number sequence
  const latestInvoices = await db.collection('invoices')
    .find({ invoiceNumber: /^MU2627-VC-/ })
    .sort({ invoiceNumber: -1 })
    .limit(1)
    .toArray();

  let nextInvSeq = 25;
  if (latestInvoices.length > 0) {
    const match = latestInvoices[0].invoiceNumber.match(/MU2627-VC-(\d+)/);
    if (match) {
      nextInvSeq = parseInt(match[1], 10) + 1;
    }
  }

  // Find latest receipt number sequence
  const latestReceipts = await db.collection('payment_receipts')
    .find({ receiptNumber: /^REC-/ })
    .sort({ receiptNumber: -1 })
    .limit(1)
    .toArray();

  let nextRecSeq = 18;
  if (latestReceipts.length > 0) {
    const match = latestReceipts[0].receiptNumber.match(/REC-(\d+)/);
    if (match) {
      nextRecSeq = parseInt(match[1], 10) + 1;
    }
  }

  const user = await db.collection('users').findOne({});
  const recordedByUserId = user ? user._id : new ObjectId('6a8a99a697afbd8b54e3704e');

  const productCatalogue = [
    { description: 'Sona Masoori Rice - 25kg Bag', hsnCode: '1006', rate: 1280, unit: 'Bag' },
    { description: 'Steam Rice Premium - 50kg Bag', hsnCode: '1006', rate: 2650, unit: 'Bag' },
    { description: 'Raw Rice (Kolam) - 25kg Bag', hsnCode: '1006', rate: 1420, unit: 'Bag' },
    { description: 'Murmura - 9kg Bag', hsnCode: '80000000', rate: 510, unit: 'Bag' },
    { description: 'Broken Rice (Kani) - 50kg Bag', hsnCode: '1006', rate: 1680, unit: 'Bag' },
    { description: 'Rice Bran (Bhusa) - 50kg Bag', hsnCode: '2302', rate: 980, unit: 'Bag' },
  ];

  const vehicles = [
    'MH14LB3947',
    'MH12RQ8821',
    'TS07UA5512',
    'MH14EE9012',
    'TS08BB1123',
    'MH04KD4490',
    'MH14CZ7788',
    'MH12AA4321',
    'TS09XY9900',
    'MH14XY5544',
  ];

  // 20 invoices across July - September 2026
  const targetCount = 20;
  const isInterState = customer.billingAddress?.stateCode !== '27';

  // Dates for 20 invoices
  const invoiceDates = [
    '2026-07-01T09:30:00.000Z',
    '2026-07-06T11:00:00.000Z',
    '2026-07-12T14:15:00.000Z',
    '2026-07-19T10:00:00.000Z',
    '2026-07-24T16:45:00.000Z',
    '2026-07-30T11:30:00.000Z',
    '2026-08-04T09:00:00.000Z',
    '2026-08-09T13:20:00.000Z',
    '2026-08-14T15:40:00.000Z',
    '2026-08-19T10:30:00.000Z',
    '2026-08-23T12:00:00.000Z',
    '2026-08-27T17:15:00.000Z',
    '2026-09-01T10:00:00.000Z',
    '2026-09-05T14:30:00.000Z',
    '2026-09-09T11:45:00.000Z',
    '2026-09-13T16:00:00.000Z',
    '2026-09-17T09:30:00.000Z',
    '2026-09-20T12:15:00.000Z',
    '2026-09-23T15:00:00.000Z',
    '2026-09-26T11:20:00.000Z',
  ];

  // Distribution of statuses: 10 PAID, 6 PARTIAL, 4 UNPAID
  const statuses = [
    'PAID',
    'PAID',
    'PARTIAL',
    'PAID',
    'UNPAID',
    'PAID',
    'PARTIAL',
    'PAID',
    'UNPAID',
    'PAID',
    'PARTIAL',
    'PAID',
    'UNPAID',
    'PAID',
    'PARTIAL',
    'PAID',
    'PARTIAL',
    'UNPAID',
    'PAID',
    'PARTIAL',
  ];

  const paymentModes = ['UPI', 'NEFT_RTGS', 'CHEQUE', 'CASH'];

  const newInvoices = [];
  const newReceipts = [];

  let totalNewBilled = 0;
  let totalNewPaid = 0;

  for (let i = 0; i < targetCount; i++) {
    const invNum = `MU2627-VC-${String(nextInvSeq + i).padStart(4, '0')}`;
    const invId = new ObjectId();
    const invDate = new Date(invoiceDates[i]);
    const dueDate = new Date(invDate.getTime() + 15 * 24 * 60 * 60 * 1000);

    const prod1 = productCatalogue[i % productCatalogue.length];
    const prod2 = productCatalogue[(i + 3) % productCatalogue.length];

    const qty1 = 20 + ((i * 6) % 50);
    const qty2 = 12 + ((i * 4) % 30);

    const items = [
      {
        description: prod1.description,
        hsnCode: prod1.hsnCode,
        qty: qty1,
        unit: prod1.unit,
        rate: prod1.rate,
        amount: qty1 * prod1.rate,
      },
    ];

    if (i % 2 === 1) {
      items.push({
        description: prod2.description,
        hsnCode: prod2.hsnCode,
        qty: qty2,
        unit: prod2.unit,
        rate: prod2.rate,
        amount: qty2 * prod2.rate,
      });
    }

    const transportCharges = (i % 3 === 0) ? 800 : (i % 3 === 1 ? 550 : 0);
    const hamaliCharges = (i % 2 === 0) ? 350 : 180;
    const discount = (i % 4 === 0) ? 250 : 0;

    const totals = calculateInvoiceTotals(items, transportCharges, hamaliCharges, discount, isInterState);
    const payStatus = statuses[i];

    let paidAmount = 0;
    let balanceAmount = totals.totalAmount;

    if (payStatus === 'PAID') {
      paidAmount = totals.totalAmount;
      balanceAmount = 0;
    } else if (payStatus === 'PARTIAL') {
      paidAmount = Math.round(totals.totalAmount * 0.45);
      balanceAmount = totals.totalAmount - paidAmount;
    }

    totalNewBilled += totals.totalAmount;
    totalNewPaid += paidAmount;

    const invDoc = {
      _id: invId,
      invoiceNumber: invNum,
      invoiceType: 'TAX_INVOICE',
      invoiceDate: invDate,
      dueDate: dueDate,
      customerId: customer._id,
      customerSnapshot: {
        customerCode: customer.customerCode,
        companyName: customer.companyName,
        contactPerson: customer.contactPerson || 'Vijay Lunkad',
        mobile: customer.mobile,
        email: customer.email || 'orders@lunkadfoods.com',
        gstin: customer.gstin || '27ACHFS3445C1Z8',
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress || customer.billingAddress,
      },
      reference: `PO-LK-${9100 + i}`,
      vehicleNumber: vehicles[i % vehicles.length],
      transportDetails: 'Direct Mill Truck Dispatch',
      lrNumber: `LR-2026-${3100 + i}`,
      items: totals.items,
      subTotal: totals.subTotal,
      transportCharges,
      hamaliCharges,
      discount,
      taxableAmount: totals.taxableAmount,
      isInterState,
      cgstPercent: totals.cgstPercent,
      cgstAmount: totals.cgstAmount,
      sgstPercent: totals.sgstPercent,
      sgstAmount: totals.sgstAmount,
      igstPercent: totals.igstPercent,
      igstAmount: totals.igstAmount,
      roundOff: totals.roundOff,
      totalAmount: totals.totalAmount,
      totalAmountWords: totals.totalAmountWords,
      paymentStatus: payStatus,
      paidAmount,
      balanceAmount,
      status: 'ISSUED',
      bankDetails: MILL_BANK_DETAILS,
      terms: '1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. will be charged if bill is not paid on due date. 3. Subject to Pune jurisdiction.',
      issuedBy: 'Executive Super Admin',
      createdAt: invDate,
      updatedAt: invDate,
    };

    newInvoices.push(invDoc);

    // If invoice had a payment, generate corresponding payment_receipt document
    if (paidAmount > 0) {
      const recNum = `REC-${String(nextRecSeq).padStart(4, '0')}`;
      nextRecSeq++;

      const pDate = new Date(invDate.getTime() + (2 + (i % 3)) * 24 * 60 * 60 * 1000);
      const mode = paymentModes[i % paymentModes.length];

      let ref = '';
      if (mode === 'UPI') ref = `UPI-${880000 + i}`;
      else if (mode === 'NEFT_RTGS') ref = `UTR-HDFC-${990000 + i}`;
      else if (mode === 'CHEQUE') ref = `CHQ-${100200 + i}`;
      else ref = 'CASH-REC';

      const recDoc = {
        receiptNumber: recNum,
        customerId: customer._id,
        invoiceId: invId,
        amount: paidAmount,
        paymentDate: pDate,
        paymentMode: mode,
        transactionReference: ref,
        notes: `Payment for ${invNum} (${payStatus === 'PAID' ? 'Full Settled' : 'Part Payment'})`,
        recordedBy: recordedByUserId,
        createdAt: pDate,
        updatedAt: pDate,
      };

      newReceipts.push(recDoc);
    }
  }

  // 1. Insert new invoices
  const invResult = await db.collection('invoices').insertMany(newInvoices);
  console.log(`Inserted ${invResult.insertedCount} new invoices for customer ${customer.companyName}`);

  // 2. Insert new payment receipts
  if (newReceipts.length > 0) {
    const recResult = await db.collection('payment_receipts').insertMany(newReceipts);
    console.log(`Inserted ${recResult.insertedCount} new payment receipts for customer ${customer.companyName}`);
  }

  // 3. Update customer accounting totals in database
  const totalNewBalance = totalNewBilled - totalNewPaid;
  await db.collection('customers').updateOne(
    { _id: customer._id },
    {
      $inc: {
        totalBilled: totalNewBilled,
        totalPaid: totalNewPaid,
        currentBalance: totalNewBalance,
      },
      $set: {
        updatedAt: new Date(),
      }
    }
  );

  console.log(`Updated customer accounting:`);
  console.log(`  + Added Billed: ₹${totalNewBilled.toLocaleString('en-IN')}`);
  console.log(`  + Added Paid:   ₹${totalNewPaid.toLocaleString('en-IN')}`);
  console.log(`  + Added Due:    ₹${totalNewBalance.toLocaleString('en-IN')}`);

  // 4. Verify updated customer record & counts
  const updatedCust = await db.collection('customers').findOne({ _id: customer._id });
  const totalInvs = await db.collection('invoices').countDocuments({ customerId: customer._id });
  const totalRecs = await db.collection('payment_receipts').countDocuments({ customerId: customer._id });

  console.log('\n=============================================');
  console.log(`CUSTOMER ${customer.companyName} SUMMARY:`);
  console.log(`  Total Lifetime Invoices in DB: ${totalInvs}`);
  console.log(`  Total Lifetime Receipts in DB: ${totalRecs}`);
  console.log(`  Total Ledger Transactions:    ${totalInvs + totalRecs}`);
  console.log(`  Total Billed:  ₹${updatedCust.totalBilled.toLocaleString('en-IN')}`);
  console.log(`  Total Paid:    ₹${updatedCust.totalPaid.toLocaleString('en-IN')}`);
  console.log(`  Current Due:   ₹${updatedCust.currentBalance.toLocaleString('en-IN')}`);
  console.log('=============================================\n');

  await mongoose.disconnect();
}

seedCustomerRecords().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
