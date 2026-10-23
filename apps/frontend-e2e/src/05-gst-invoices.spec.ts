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

    // Enter Quantity and verify step is 1 and up/down increments by 1
    const qtyInput = page.locator('input[formcontrolname="qty"]').first();
    await expect(qtyInput).toHaveAttribute('step', '1');
    await expect(qtyInput).toHaveAttribute('min', '1');
    await qtyInput.fill('50');
    await qtyInput.press('ArrowUp');
    await expect(qtyInput).toHaveValue('51');
    await qtyInput.press('ArrowDown');
    await expect(qtyInput).toHaveValue('50');

    // Verify GST tax rate input and preset buttons
    const gstRateInput = page.locator('#invoice-gst-rate-input');
    await expect(gstRateInput).toBeVisible();
    await expect(gstRateInput).toHaveAttribute('step', '1');
    await expect(gstRateInput).toHaveValue('5');

    // Test stepper increment by 1
    await gstRateInput.press('ArrowUp');
    await expect(gstRateInput).toHaveValue('6');
    await gstRateInput.press('ArrowDown');
    await expect(gstRateInput).toHaveValue('5');

    // Test clicking 12% preset pill
    const preset12Btn = page.locator('#btn-gst-preset-12');
    await preset12Btn.click();
    await expect(gstRateInput).toHaveValue('12');

    // Live preview table should reflect 6% CGST and 6% SGST
    const liveSheet = page.locator('.mill-bill-sheet');
    await expect(liveSheet).toBeVisible();
    await expect(liveSheet).toContainText('SGST (6%)');
    await expect(liveSheet).toContainText('CGST (6%)');

    // Switch back to 5% standard preset
    await page.locator('#btn-gst-preset-5').click();
    await expect(gstRateInput).toHaveValue('5');
    await expect(liveSheet).toContainText('SGST (2.5%)');
    await expect(liveSheet).toContainText('CGST (2.5%)');

    // Verify live sheet preview on the right shows customer name and item, and no copy indicator checkboxes
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

  test('TC-INV-06: Record Payment Receipt triggers confirmation popup before submission', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForSelector('table.data-table tbody tr');

    // Find a row with a '+₹ Pay' button
    const payBtn = page.locator('button.btn-action-pay').first();
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // Verify modal appears
    const modalCard = page.locator('app-record-payment-modal .modal-card');
    await expect(modalCard).toBeVisible();
    await expect(modalCard.locator('h3')).toContainText(/Record Payment Receipt/i);

    // Verify payment amount is NOT prefilled and submit button is initially disabled
    const amountInput = modalCard.locator('#input-payment-amount');
    await expect(amountInput).toHaveValue('');
    const submitBtn = modalCard.locator('#btn-modal-record-payment');
    await expect(submitBtn).toBeDisabled();

    // Fill in payment amount
    await amountInput.fill('5000');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify confirm dialog appears on top
    const confirmDialog = page.locator('app-confirm-dialog .confirm-card');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.locator('.confirm-title')).toContainText(/Confirm Payment Receipt/i);
    await expect(confirmDialog.locator('.confirm-message')).toContainText(/Are you sure you want to record a payment of/i);

    // Click Cancel in confirm dialog
    const cancelBtn = confirmDialog.locator('.btn-dialog-cancel');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Verify confirm dialog closes, but payment modal remains open
    await expect(confirmDialog).not.toBeVisible();
    await expect(modalCard).toBeVisible();

    // Close payment modal
    await modalCard.locator('.modal-close-btn').click();
    await expect(modalCard).not.toBeVisible();
  });

  test('TC-INV-07: View-Only Admin is restricted from editing invoices, recording payments, and creating bills', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await loginAs(page, TEST_USERS.viewer);
    await page.goto('/invoices');
    await page.waitForLoadState('domcontentloaded');

    // Create button should not be visible for view-only users
    await expect(page.locator('#btn-new-tax-invoice')).not.toBeVisible();

    // In the invoice list table, Edit button and Pay button must not be visible
    await page.waitForSelector('table.data-table tbody tr');
    await expect(page.locator('button.btn-edit')).not.toBeVisible();
    await expect(page.locator('button.btn-action-pay')).not.toBeVisible();

    // Print & Download buttons should still remain accessible for auditing
    await expect(page.locator('button.btn-print').first()).toBeVisible();
    await expect(page.locator('button.btn-pdf').first()).toBeVisible();
  });

  test('TC-INV-08: View-Only Admin cannot see Register New Buyer triggers on invoice form', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await loginAs(page, TEST_USERS.viewer);
    await page.goto('/invoices/new');
    await page.waitForLoadState('domcontentloaded');

    // "+ Register New Buyer" button next to customer dropdown label must NOT be visible
    await expect(page.locator('.btn-register-buyer')).not.toBeVisible();

    // Open customer dropdown
    const customerTrigger = page.locator('#select-customer-trigger');
    if (await customerTrigger.isVisible()) {
      await customerTrigger.click();
      // Dropdown footer "+ Register New Buyer" button must NOT be visible
      await expect(page.locator('.btn-footer-add-buyer')).not.toBeVisible();
    }
  });
});


