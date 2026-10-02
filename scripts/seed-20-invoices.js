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

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rice_mill_erp';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const customers = await db.collection('customers').find().toArray();
  const products = await db.collection('products').find().toArray();

  if (customers.length === 0) {
    console.error('No customers found to associate invoices with!');
    await mongoose.disconnect();
    return;
  }

  // Sample items template
  const productCatalogue = [
    { description: 'Sona Masoori Rice - 25kg Bag', hsnCode: '1006', rate: 1250, unit: 'Bag' },
    { description: 'Steam Rice Premium - 50kg Bag', hsnCode: '1006', rate: 2600, unit: 'Bag' },
    { description: 'Raw Rice (Kolam) - 25kg Bag', hsnCode: '1006', rate: 1400, unit: 'Bag' },
    { description: 'Murmura - 9kg Bag', hsnCode: '80000000', rate: 490, unit: 'Bag' },
    { description: 'Broken Rice (Kani) - 50kg Bag', hsnCode: '1006', rate: 1650, unit: 'Bag' },
    { description: 'Rice Bran (Bhusa) - 50kg Bag', hsnCode: '2302', rate: 950, unit: 'Bag' },
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

  // Starting invoice sequence from MU2627-VC-0005
  const baseSequence = 5;
  const targetCount = 20;

  const dates = [
    '2026-06-15T00:00:00.000Z',
    '2026-06-22T00:00:00.000Z',
    '2026-07-03T00:00:00.000Z',
    '2026-07-10T00:00:00.000Z',
    '2026-07-18T00:00:00.000Z',
    '2026-07-25T00:00:00.000Z',
    '2026-08-02T00:00:00.000Z',
    '2026-08-10T00:00:00.000Z',
    '2026-08-15T00:00:00.000Z',
    '2026-08-20T00:00:00.000Z',
    '2026-08-28T00:00:00.000Z',
    '2026-09-02T00:00:00.000Z',
    '2026-09-05T00:00:00.000Z',
    '2026-09-10T00:00:00.000Z',
    '2026-09-14T00:00:00.000Z',
    '2026-09-18T00:00:00.000Z',
    '2026-09-21T00:00:00.000Z',
    '2026-09-24T00:00:00.000Z',
    '2026-09-25T00:00:00.000Z',
    '2026-09-26T00:00:00.000Z',
  ];

  const paymentStatuses = [
    'PAID',
    'PARTIAL',
    'UNPAID',
    'PAID',
    'UNPAID',
    'PARTIAL',
    'PAID',
    'PAID',
    'UNPAID',
    'PARTIAL',
    'PAID',
    'UNPAID',
    'PARTIAL',
    'PAID',
    'UNPAID',
    'PARTIAL',
    'PAID',
    'PAID',
    'UNPAID',
    'PARTIAL',
  ];

  const newInvoices = [];

  for (let i = 0; i < targetCount; i++) {
    const invNum = `MU2627-VC-${String(baseSequence + i).padStart(4, '0')}`;

    // Cycle through all customers
    const cust = customers[i % customers.length];
    const isInterState = cust.billingAddress?.stateCode !== '27';

    // Pick 1 or 2 products
    const prod1 = productCatalogue[i % productCatalogue.length];
    const prod2 = productCatalogue[(i + 2) % productCatalogue.length];

    const qty1 = 15 + ((i * 7) % 60);
    const qty2 = 10 + ((i * 5) % 40);

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

    if (i % 2 === 0) {
      items.push({
        description: prod2.description,
        hsnCode: prod2.hsnCode,
        qty: qty2,
        unit: prod2.unit,
        rate: prod2.rate,
        amount: qty2 * prod2.rate,
      });
    }

    const transportCharges = (i % 3 === 0) ? 750 : (i % 3 === 1 ? 500 : 0);
    const hamaliCharges = (i % 2 === 0) ? 300 : 150;
    const discount = (i % 5 === 0) ? 200 : 0;

    const totals = calculateInvoiceTotals(items, transportCharges, hamaliCharges, discount, isInterState);

    const payStatus = paymentStatuses[i];
    let paidAmount = 0;
    let balanceAmount = totals.totalAmount;

    if (payStatus === 'PAID') {
      paidAmount = totals.totalAmount;
      balanceAmount = 0;
    } else if (payStatus === 'PARTIAL') {
      paidAmount = Math.round(totals.totalAmount * 0.4);
      balanceAmount = totals.totalAmount - paidAmount;
    }

    const invDoc = {
      invoiceNumber: invNum,
      invoiceType: 'TAX_INVOICE',
      invoiceDate: new Date(dates[i]),
      dueDate: new Date(new Date(dates[i]).getTime() + 15 * 24 * 60 * 60 * 1000),
      customerId: cust._id,
      customerSnapshot: {
        customerCode: cust.customerCode,
        companyName: cust.companyName,
        contactPerson: cust.contactPerson || 'Dispatch Manager',
        mobile: cust.mobile,
        email: cust.email || '',
        gstin: cust.gstin || 'UNREGISTERED',
        billingAddress: cust.billingAddress || {
          line1: 'Market Road',
          city: 'Pune',
          state: 'Maharashtra',
          stateCode: '27',
          pincode: '411001',
        },
      },
      reference: `PO-${8900 + i}`,
      vehicleNumber: vehicles[i % vehicles.length],
      transportDetails: 'Direct Mill Truck Dispatch',
      lrNumber: `LR-2026-${1000 + i}`,
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
      createdAt: new Date(dates[i]),
      updatedAt: new Date(dates[i]),
    };

    newInvoices.push(invDoc);

    // Update customer accounting totals
    await db.collection('customers').updateOne(
      { _id: cust._id },
      {
        $inc: {
          totalBilled: totals.totalAmount,
          totalPaid: paidAmount,
          currentBalance: balanceAmount,
        },
      }
    );
  }

  // Insert all 20 invoices
  const result = await db.collection('invoices').insertMany(newInvoices);
  console.log(`Successfully seeded ${result.insertedCount} invoices!`);

  const totalInvoices = await db.collection('invoices').countDocuments();
  console.log(`Total invoices in database is now: ${totalInvoices}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
