import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs } from './test-helpers';

test.describe('05: GST Sales Invoices & Billing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto('/invoices');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-INV-01: Invoices list renders header, metric cards, search inputs, and invoice table', async ({ page }) => {
    await expect(page.locator('h1.page-title')).toContainText('Sales Invoices & Billing');

    // Metrics grid (Total Invoices, Revenue, Collected, Receivables)
    const metricCards = page.locator('.metric-card');
    expect(await metricCards.count()).toBe(4);

    // Search inputs
    await expect(page.locator('#invoice-buyer-filter-input')).toBeVisible();
    await expect(page.locator('#invoice-search-input')).toBeVisible();

    // Table
    const table = page.locator('table.data-table');
    await expect(table.first()).toBeVisible();

    // Table headers
    const headers = await table.first().locator('thead').innerText();
    expect(headers).toMatch(/INVOICE NUMBER/i);
    expect(headers).toMatch(/BUYER NAME/i);
    expect(headers).toMatch(/BILL TOTAL/i);
    expect(headers).toMatch(/PAYMENT STATUS/i);
  });

  test('TC-INV-02: Search input filters invoice list', async ({ page }) => {
    await page.waitForSelector('table.data-table tbody tr');
    const searchInput = page.locator('#invoice-search-input');
    await expect(searchInput).toBeVisible();

    // Get the first invoice row's number
    const firstRowText = await page.locator('table.data-table tbody tr').first().innerText();
    const match = firstRowText.match(/MU\d+|VC-\d+|INV-\d+/i);
    const searchTerm = match ? match[0] : 'MU';

    // Type search term
    await searchInput.fill(searchTerm);
    await page.waitForTimeout(400);

    const rows = page.locator('table.data-table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(400);
  });

  test('TC-INV-03: Create new GST Tax Invoice with customer selection and live sheet preview', async ({ page }) => {
    await page.goto('/invoices/new');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1.page-title')).toContainText(/New Sales Bill/i);

    // Verify Bill To block initially does not prefill Pune - 411033
    const billToBox = page.locator('.bill-to-box');
    await expect(billToBox).toBeVisible();
    await expect(billToBox).toContainText(/Select a Buyer/i);
    await expect(billToBox).not.toContainText('Pune - 411033');

    // Select customer from instant search trigger
    const customerTrigger = page.locator('#select-customer-trigger');
    await expect(customerTrigger).toBeVisible();
    await customerTrigger.click();

    // Dropdown opens
    const dropdown = page.locator('.buyer-filter-dropdown');
    await expect(dropdown).toBeVisible();

    // Click first buyer option
    const firstOption = dropdown.locator('.buyer-row-item').first();
    await expect(firstOption).toBeVisible();
    const selectedCustomerName = await firstOption.locator('.buyer-company-name').innerText();
    await firstOption.click();

    // Verify selected in trigger
    await expect(customerTrigger.locator('.trigger-name')).toContainText(selectedCustomerName);

    // Enter Vehicle Number
    const vehicleInput = page.locator('input[formcontrolname="vehicleNumber"]');
    if (await vehicleInput.isVisible()) {
      await vehicleInput.fill('TS-08-UB-4521');
    }

    // Select Product from Preset dropdown
    const productPreset = page.locator('.form-select-sm').first();
    await productPreset.selectOption({ index: 1 });

    // Enter Quantity
    const qtyInput = page.locator('input[formcontrolname="qty"]').first();
    await qtyInput.fill('50');

    // Verify live sheet preview on the right shows customer name and item, and no copy indicator checkboxes
    const liveSheet = page.locator('.mill-bill-sheet');
    await expect(liveSheet).toBeVisible();
    await expect(liveSheet).toContainText(selectedCustomerName);
    await expect(liveSheet).not.toContainText('Original for Recipient');
    await expect(liveSheet).not.toContainText('Duplicate for transporter');
    await expect(liveSheet).not.toContainText('Triplicate for suppliers');

    // Save invoice to DB
    const saveBtn = page.locator('.workspace-actions .btn-secondary');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Wait for redirect to /invoices
    await page.waitForURL('**/invoices', { timeout: 15000 });
    expect(page.url()).toContain('/invoices');
  });

  test('TC-INV-04: View/Print invoice page renders A4 sheet with proper borders and Rupee symbol', async ({ page }) => {
    await page.waitForSelector('table.data-table tbody tr');
    // Click Print Bill icon button
    const printBtn = page.locator('button.btn-print[title="Print Bill"]').first();
    await expect(printBtn).toBeVisible();
    await printBtn.click();

    await page.waitForURL('**/print');
    expect(page.url()).toContain('/print');

    // Control bar
    await expect(page.locator('.print-control-bar, .no-print')).toBeVisible();

    // A4 sheet
    const sheet = page.locator('.printable-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).not.toContainText('Original for Recipient');
    await expect(sheet).not.toContainText('Duplicate for transporter');
    await expect(sheet).not.toContainText('Triplicate for suppliers');
    await expect(sheet.first()).toBeVisible();

    // Check mill name heading
    await expect(page.locator('h1.mill-name, .mill-name').first()).toBeVisible();

    // Check Indian Rupee symbol is present in totals
    const sheetText = await sheet.first().innerText();
    expect(sheetText).toContain('₹');
  });

  test('TC-INV-05: Backend Invoice PDF endpoint returns valid PDF stream', async ({ page, request }) => {
    await page.waitForSelector('table.data-table tbody tr');
    // Click Print Bill icon button to get invoice ID
    const printBtn = page.locator('button.btn-print[title="Print Bill"]').first();
    await printBtn.click();
    await page.waitForURL('**/print');

    // Extract invoice id e.g. /invoices/6acbc9f1dbd8d47d4ccb8bdb/print
    const match = page.url().match(/\/invoices\/([a-zA-Z0-9]+)\/print/);
    expect(match).toBeTruthy();
    const invoiceId = match![1];

    // Get token
    const token = await page.evaluate(() => localStorage.getItem('rice_mill_token') || '');
    expect(token).toBeTruthy();

    // Request PDF from backend API
    const response = await request.get(`http://localhost:3000/api/invoices/${invoiceId}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');
    const body = await response.body();
    // PDF Magic bytes %PDF
    expect(body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
