import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs } from './test-helpers';

test.describe('06: Bill Invoices (Non-GST / Internal Bills)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto('/bill-invoices');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-BILL-01: Bill Invoices list renders header, metric cards, filter toolbar, and table', async ({ page }) => {
    await expect(page.locator('h1.page-title')).toContainText('Bill Invoices');
    await expect(page.locator('.badge-tag')).toContainText('Non-GST');

    // Metrics grid (Total Bills, Total Bill Amount, Accounting Status)
    const metricCards = page.locator('.metric-card');
    expect(await metricCards.count()).toBe(3);
    await expect(page.locator('.isolation-text')).toContainText('100% Isolated');

    // Toolbar
    await expect(page.locator('#search-bill-invoices')).toBeVisible();
    await expect(page.locator('#filter-bill-customer-trigger')).toBeVisible();

    // CTA
    await expect(page.locator('#btn-create-bill-invoice')).toBeVisible();
  });

  test('TC-BILL-02: Search and customer filter filter the bill invoices list', async ({ page }) => {
    const searchInput = page.locator('#search-bill-invoices');
    await expect(searchInput).toBeVisible();

    // Test search filter typing
    await searchInput.fill('BILL');
    await page.waitForTimeout(300);

    // Filter trigger
    const filterTrigger = page.locator('#filter-bill-customer-trigger');
    await filterTrigger.click();

    const dropdown = page.locator('.customer-filter-panel');
    await expect(dropdown).toBeVisible();

    // Reset filter
    await page.locator('.reset-option').click();
    await expect(dropdown).not.toBeVisible();
  });

  test('TC-BILL-03: Create Bill Invoice workflow with customer selection, item entry, and live preview sync', async ({ page }) => {
    await page.goto('/bill-invoices/create');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1.page-title')).toContainText('Create Bill Invoice');

    // Auto-generated Bill Number is present
    const billNumBadge = page.locator('.top-bill-number-badge .num-val');
    await expect(billNumBadge).toBeVisible();
    const billNum = await billNumBadge.innerText();
    expect(billNum).toMatch(/BILL/i);

    // Select existing customer via instant search
    const customerTrigger = page.locator('#customer-search-trigger');
    await customerTrigger.click();

    const customerPanel = page.locator('.customer-dropdown-panel');
    await expect(customerPanel).toBeVisible();

    const firstCustomer = customerPanel.locator('.customer-list-item').first();
    await expect(firstCustomer).toBeVisible();
    const custName = await firstCustomer.locator('.item-name').innerText();
    await firstCustomer.click();

    // Customer selected in trigger
    await expect(customerTrigger.locator('.cust-name-text')).toContainText(custName);

    // Verify buyer name input is filled
    const buyerNameInput = page.locator('#buyer-name');
    await expect(buyerNameInput).toHaveValue(custName);

    // Enter item details
    const descInput = page.locator('.desc-input').first();
    await descInput.fill('Special Murmura Grade A');

    const qtyInput = page.locator('table.items-edit-table tbody tr input[type="number"]').first();
    await qtyInput.fill('25');

    const rateInput = page.locator('table.items-edit-table tbody tr input[type="number"]').nth(1);
    await rateInput.fill('480');

    // Live Sample Bill Preview on right column
    const previewSheet = page.locator('.sample-bill-preview-sheet');
    await expect(previewSheet).toBeVisible();
    await expect(previewSheet.locator('.buyer-preview-name')).toContainText(custName);
    await expect(previewSheet).toContainText('Special Murmura Grade A');

    // Save Bill
    const saveBtn = page.locator('#btn-save-bill');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Wait for redirect to print page (/bill-invoices/:id/print)
    await page.waitForURL('**/bill-invoices/**/print', { timeout: 15000 });
    expect(page.url()).toContain('/print');

    // Printable sheet renders with Rupee symbol
    const printSheet = page.locator('.bill-invoice-sheet');
    await expect(printSheet).toBeVisible();
    await expect(printSheet).toContainText('BILL INVOICE');
    await expect(printSheet).toContainText(custName);
    await expect(printSheet).toContainText('₹');
  });

  test('TC-BILL-04: Printable bill view renders headers, borders, totals, and print action', async ({ page }) => {
    // Navigate to bill list and click first bill's view icon
    await page.waitForSelector('table.data-table tbody tr');
    const firstBillLink = page.locator('table.data-table tbody tr a.bill-num-link').first();
    await firstBillLink.click();

    await page.waitForURL('**/bill-invoices/**/print');
    expect(page.url()).toContain('/print');

    // Verify sheet title and structure
    await expect(page.locator('h1.sheet-title')).toContainText('BILL INVOICE');
    await expect(page.locator('.metadata-two-col-box')).toBeVisible();
    await expect(page.locator('.bill-items-table')).toBeVisible();
    await expect(page.locator('.totals-outlined-box')).toBeVisible();
    await expect(page.locator('.sig-label')).toContainText('Authorized Signature');

    // Print button exists with correct id
    await expect(page.locator('#btn-print-bill-action')).toBeVisible();
    await expect(page.locator('#btn-download-bill-pdf')).toBeVisible();
  });

  test('TC-BILL-05: Backend Bill Invoice PDF stream returns valid PDF stream', async ({ page, request }) => {
    await page.waitForSelector('table.data-table tbody tr');
    const firstBillLink = page.locator('table.data-table tbody tr a.bill-num-link').first();
    await firstBillLink.click();
    await page.waitForURL('**/bill-invoices/**/print');

    // Extract bill ID from URL: /bill-invoices/6acbc9f1dbd8d47d4ccb8bdb/print
    const match = page.url().match(/\/bill-invoices\/([a-zA-Z0-9]+)\/print/);
    expect(match).toBeTruthy();
    const billId = match![1];

    const token = await page.evaluate(() => localStorage.getItem('rice_mill_token') || '');
    expect(token).toBeTruthy();

    const response = await request.get(`http://localhost:3000/api/bill-invoices/${billId}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');
    const body = await response.body();
    // %PDF header
    expect(body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
