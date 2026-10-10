/**
 * ==============================================================================
 * RICE MILL ERP — MONGODB COMPASS / MONGOSH INITIALIZATION SCRIPT
 * ==============================================================================
 * How to run in MongoDB Compass:
 * 1. Open MongoDB Compass and connect to your production MongoDB database/cluster.
 * 2. Click the "_MONGOSH" tab located at the bottom of the Compass window.
 * 3. Copy and paste this entire script into the MONGOSH terminal and hit Enter.
 *
 * Safe & Idempotent:
 * - Uses $setOnInsert and upsert: true
 * - Existing documents are NOT overwritten or duplicated.
 * ==============================================================================
 */

// 1. Select the database
const dbName = 'rice_mill_erp';
db = db.getSiblingDB(dbName);
print('\n================================================================');
print('🌾 Connected to database: "' + db.getName() + '"');
print('================================================================\n');

// 2. Seed Enterprise RBAC Users (with verified pre-hashed bcrypt strings)
print('--- Step 1: Seeding Enterprise RBAC Users ---');

try {
  db.users.createIndex({ email: 1 }, { unique: true });
} catch (e) {
  // Index already exists
}

const initialUsers = [
  {
    name: 'Executive Super Admin',
    email: 'superadmin@ricemill.com',
    password: '$2b$10$9s5zm9g/f7Bz6kJklOOaeeDm.JVJGfoHl1RPgCK6du2wcDwA6SfPq', // SuperAdmin@123
    employeeId: 'EMP-001',
    mobile: '+91 9876543210',
    role: 'SUPER_ADMIN',
    isActive: true,
  },
  {
    name: 'Mill Administrator',
    email: 'admin@ricemill.com',
    password: '$2b$10$I/ldWtabFzj1kgFV3J1FR.tZyuuBqS/GL5/ua645v4kpQ6jUTV7.C', // Admin@123
    employeeId: 'EMP-002',
    mobile: '+91 9876543211',
    role: 'ADMIN',
    isActive: true,
  },
  {
    name: 'View Only Auditor / Admin',
    email: 'viewer@ricemill.com',
    password: '$2b$10$VpFrVxhfNFzr4GZ3pNh48.8F0VgzkSLunWOhsOQb/kEujlqGKvfy2', // Viewer@123
    employeeId: 'EMP-003',
    mobile: '+91 9876543212',
    role: 'VIEW_ONLY_ADMIN',
    isActive: true,
  },
];

let usersCreated = 0;
let usersSkipped = 0;

initialUsers.forEach(function (user) {
  const res = db.users.updateOne(
    { email: user.email.toLowerCase() },
    {
      $setOnInsert: {
        name: user.name,
        email: user.email.toLowerCase(),
        password: user.password,
        employeeId: user.employeeId,
        mobile: user.mobile,
        role: user.role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  if (res.upsertedCount > 0) {
    print('  ✔ Created User: ' + user.name.padEnd(28) + ' [' + user.role + '] (' + user.email + ')');
    usersCreated++;
  } else {
    print('  ↷ Skipped User: ' + user.name.padEnd(28) + ' [' + user.role + '] (Already exists)');
    usersSkipped++;
  }
});
print('Users: ' + usersCreated + ' created, ' + usersSkipped + ' already existing.\n');

// 3. Seed Centralized Mill & Enterprise Profile
print('--- Step 2: Seeding Mill & Enterprise Profile ---');
const companyCount = db.company.countDocuments({});

if (companyCount === 0) {
  db.company.insertOne({
    millName: 'SHREE LAXMINARAYAN RICE MILL',
    tagline: 'Operations Hub',
    gstin: '27ACHFS3445C1Z8',
    fssaiNumber: '21526038000229',
    mobile: '9960186123',
    alternatePhone: '9970901007',
    email: 'slricemill@gmail.com',
    contactPerson: 'Proprietor',
    address: {
      street: 'Hivare Tarfe Narayangaon, Khodad Road',
      taluka: 'Tal:- Junnar',
      district: 'Dist:- Pune',
      state: 'Maharashtra',
      pincode: '410504',
    },
    bankDetails: {
      bankName: 'HDFC Bank Ltd',
      accountNumber: '50200067891234',
      ifsc: 'HDFC0001234',
      branch: 'Narayangaon Branch, Pune',
      upiId: 'slricemill@hdfcbank',
    },
    termsAndConditions: [
      '1. Goods once sold will not be taken back.',
      '2. Interest @ 18% p.a. will be charged if bill is not paid on due date.',
      '3. Subject to Pune jurisdiction.',
    ],
    jurisdiction: 'Pune',
    devotionalHeaders: {
      left: '|| Perantal Mata Prasana ||',
      center: '|| Shree Ganeshya Namha ||',
      right: '|| Shree Mukatai Prasana ||',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  print('  ✔ Created Mill Profile: "SHREE LAXMINARAYAN RICE MILL"');
  print('    GSTIN: 27ACHFS3445C1Z8 | FSSAI: 21526038000229');
  print('    Bank: HDFC Bank Ltd (A/C: 50200067891234)');
} else {
  const existing = db.company.findOne({});
  print('  ↷ Skipped Mill Profile: Already configured in DB ("' + (existing.millName || 'Configured') + '")');
}
print('');

// 4. Seed Standard Rice Mill Catalog Products
print('--- Step 3: Seeding Default Product Catalog ---');

try {
  db.products.createIndex({ productCode: 1 }, { unique: true });
} catch (e) {
  // Index already exists
}

const initialProducts = [
  {
    productCode: 'PROD-001',
    name: 'Murmura',
    category: 'PACKAGED',
    hsnCode: '80000000',
    bagWeightKg: 9,
    unit: 'BAG',
    defaultRate: 490,
    taxRatePercent: 5,
    isActive: true,
  },
  {
    productCode: 'PROD-002',
    name: 'Sona Masoori Rice',
    category: 'RICE',
    hsnCode: '1006',
    bagWeightKg: 25,
    unit: 'BAG',
    defaultRate: 1450,
    taxRatePercent: 5,
    isActive: true,
  },
  {
    productCode: 'PROD-003',
    name: 'Steam Rice Premium',
    category: 'RICE',
    hsnCode: '1006',
    bagWeightKg: 50,
    unit: 'BAG',
    defaultRate: 2850,
    taxRatePercent: 5,
    isActive: true,
  },
  {
    productCode: 'PROD-004',
    name: 'Raw Rice (Kolam)',
    category: 'RICE',
    hsnCode: '1006',
    bagWeightKg: 25,
    unit: 'BAG',
    defaultRate: 1650,
    taxRatePercent: 5,
    isActive: true,
  },
  {
    productCode: 'PROD-005',
    name: 'Broken Rice (Kani)',
    category: 'BY_PRODUCT',
    hsnCode: '1006',
    bagWeightKg: 50,
    unit: 'BAG',
    defaultRate: 1150,
    taxRatePercent: 5,
    isActive: true,
  },
  {
    productCode: 'PROD-006',
    name: 'Rice Bran (Bhusa)',
    category: 'BY_PRODUCT',
    hsnCode: '2302',
    bagWeightKg: 50,
    unit: 'BAG',
    defaultRate: 850,
    taxRatePercent: 5,
    isActive: true,
  },
];

let productsCreated = 0;
let productsSkipped = 0;

initialProducts.forEach(function (prod) {
  const res = db.products.updateOne(
    { productCode: prod.productCode },
    {
      $setOnInsert: {
        productCode: prod.productCode,
        name: prod.name,
        category: prod.category,
        hsnCode: prod.hsnCode,
        bagWeightKg: prod.bagWeightKg,
        unit: prod.unit,
        defaultRate: prod.defaultRate,
        taxRatePercent: prod.taxRatePercent,
        isActive: prod.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  if (res.upsertedCount > 0) {
    print('  ✔ Created Product: ' + prod.productCode + ' - ' + prod.name + ' (' + prod.bagWeightKg + 'kg / ₹' + prod.defaultRate + ')');
    productsCreated++;
  } else {
    print('  ↷ Skipped Product: ' + prod.productCode + ' - ' + prod.name + ' (Already exists)');
    productsSkipped++;
  }
});
print('Products: ' + productsCreated + ' created, ' + productsSkipped + ' already existing.\n');

// 5. Core Performance & Integrity Indexes
print('--- Step 4: Creating Core Database Indexes ---');
try {
  db.customers.createIndex({ phone: 1 });
  db.customers.createIndex({ companyName: 1 });
  db.invoices.createIndex({ invoiceNumber: 1 }, { unique: true });
  db.invoices.createIndex({ customerId: 1, invoiceDate: -1 });
  print('  ✔ Customer & Invoice indexes ensured.\n');
} catch (e) {
  print('  ↷ Indexes already present.\n');
}

print('================================================================');
print('🎉 PRODUCTION DATABASE INITIALIZATION COMPLETE!');
print('================================================================');
print('Super Admin Credentials:');
print('  Email:    superadmin@ricemill.com');
print('  Password: SuperAdmin@123');
print('  Role:     SUPER_ADMIN');
print('----------------------------------------------------------------');
print('Mill Admin Credentials:');
print('  Email:    admin@ricemill.com');
print('  Password: Admin@123');
print('  Role:     ADMIN');
print('================================================================\n');
