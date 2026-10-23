import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs } from './test-helpers';

test.describe('04: Customers & Khata Ledger Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto('/customers');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-CUST-01: Customers directory renders heading, metrics, filters, and table', async ({ page }) => {
    await expect(page.locator('h1.page-title')).toContainText('Buyers & Customer Directory');

    // Metrics grid
    const metricCards = page.locator('.metric-card');
    expect(await metricCards.count()).toBe(4);

    // Search and filter pills
    await expect(page.locator('#customer-search-input')).toBeVisible();
    await expect(page.locator('.filter-pill').first()).toBeVisible();

    // Table
    const table = page.locator('table.data-table');
    await expect(table.first()).toBeVisible();

    // Table headers
    const headers = await table.first().locator('thead').innerText();
    expect(headers).toMatch(/Trade \/ Firm Name/i);
    expect(headers).toMatch(/Contact/i);
    expect(headers).toMatch(/City \/ State/i);
    expect(headers).toMatch(/GSTIN/i);
    expect(headers).toMatch(/Total Billed/i);
    expect(headers).toMatch(/Balance Due/i);
  });

  test('TC-CUST-02: Instant search filters customer rows', async ({ page }) => {
    const searchInput = page.locator('#customer-search-input');
    await expect(searchInput).toBeVisible();

    // Fill search term
    await searchInput.fill('CUST');
    await page.waitForTimeout(300);

    const rows = page.locator('table.data-table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);
  });

  test('TC-CUST-03: Add Customer modal validates required fields and registers new buyer', async ({ page }) => {
    const addBtn = page.locator('#btn-add-customer');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toContainText(/Register New Buyer/i);

    // 1. Submit empty form to trigger validation
    const submitBtn = modal.locator('button[type="submit"]');
    await submitBtn.click();

    // Form fields should show error styling
    await expect(modal.locator('.form-group.has-error').first()).toBeVisible();

    // 2. Fill required fields
    const testId = Date.now().toString().slice(-4);
    const testCompanyName = `QA Traders Firm ${testId}`;
    const testMobile = `98${testId.padStart(8, '0')}`;

    await modal.locator('input[formcontrolname="companyName"]').fill(testCompanyName);
    await modal.locator('input[formcontrolname="contactPerson"]').fill(`Contact ${testId}`);
    await modal.locator('input[formcontrolname="mobile"]').fill(testMobile);
    await modal.locator('input[formcontrolname="line1"]').fill('Shop 12, Grain Market Road');
    await modal.locator('input[formcontrolname="city"]').fill('Nizamabad');
    await modal.locator('input[formcontrolname="state"]').fill('Telangana');
    await modal.locator('input[formcontrolname="pincode"]').fill('503001');

    // Submit
    await submitBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verify newly registered buyer is listed
    const searchInput = page.locator('#customer-search-input');
    await searchInput.fill(testCompanyName);
    await page.waitForTimeout(500);

    const buyerRow = page.locator(`tr:has-text("${testCompanyName}")`);
    await expect(buyerRow).toBeVisible();
    await expect(buyerRow).toContainText('Nizamabad');
  });

  test('TC-CUST-04: Customer detail page renders hero card, metrics, and ledger table', async ({ page }) => {
    // Click first customer firm link
    const firstFirm = page.locator('.clickable-firm, .firm-name-text').first();
    await expect(firstFirm).toBeVisible();
    const firmName = await firstFirm.innerText();

    await firstFirm.click();
    await page.waitForURL(/\/customers\/[a-zA-Z0-9]+$/);
    expect(page.url()).toMatch(/\/customers\/[a-zA-Z0-9]+/);

    // Hero title
    await expect(page.locator('h1.firm-name-heading')).toContainText(firmName.replace(/View Profile →/i, '').trim());

    // Metrics grid (Total Invoices, Revenue, Collected, Outstanding Due)
    const metricCards = page.locator('.metric-card');
    expect(await metricCards.count()).toBe(4);

    // Action buttons
    await expect(page.locator('#btn-edit-buyer')).toBeVisible();

    // Status toggle button
    const statusBtn = page.locator('.btn-status-toggle');
    await expect(statusBtn).toBeVisible();
  });

  test('TC-CUST-05: Customer statement print page renders sheet, control bar, and filters', async ({ page }) => {
    // Navigate to first customer
    const firstFirm = page.locator('.clickable-firm, .firm-name-text').first();
    await firstFirm.click();
    await page.waitForURL(/\/customers\/[a-zA-Z0-9]+$/);

    // Extract customer ID from URL
    const urlParts = page.url().split('/');
    const customerId = urlParts[urlParts.length - 1];

    // Navigate to statement page
    await page.goto(`/customers/${customerId}/statement`);
    await page.waitForLoadState('domcontentloaded');

    // Control bar
    const controlBar = page.locator('.print-control-bar');
    await expect(controlBar).toBeVisible();
    await expect(page.locator('#btn-download-pdf')).toBeVisible();
    await expect(page.locator('#btn-print-action')).toBeVisible();

    // Preset filter buttons
    const presetBtns = page.locator('.btn-filter-preset');
    expect(await presetBtns.count()).toBeGreaterThanOrEqual(4);

    // Statement sheet container
    const sheet = page.locator('.statement-sheet, .sheet-container, .statement-print-page');
    await expect(sheet.first()).toBeVisible();

    // Check mill name heading on statement
    const millHeading = page.locator('h1.mill-name, .mill-name');
    await expect(millHeading.first()).toBeVisible();

    // Back button returns to customer profile
    await page.locator('.btn-back').click();
    await page.waitForURL(`**/customers/${customerId}`);
    expect(page.url()).toContain(`/customers/${customerId}`);
  });

  test('TC-CUST-06: View-Only Admin cannot add a new buyer, edit profiles, or collect payments', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await loginAs(page, TEST_USERS.viewer);
    await page.goto('/customers');
    await page.waitForLoadState('domcontentloaded');

    // 1. Directory Page: Add New Buyer & Create New Bill buttons must not exist
    await expect(page.locator('#btn-add-customer')).not.toBeVisible();
    await expect(page.locator('#btn-create-invoice')).not.toBeVisible();

    // 2. Directory Page: Row action "+ Bill" button must not exist
    await page.waitForSelector('table.data-table tbody tr');
    await expect(page.locator('.btn-action.btn-bill')).not.toBeVisible();

    // But View Profile / Khata action must still be visible and functional
    const firstFirm = page.locator('.clickable-firm, .firm-name-text').first();
    await expect(firstFirm).toBeVisible();
    await firstFirm.click();
    await page.waitForURL(/\/customers\/[a-zA-Z0-9]+$/);

    // 3. Customer Details Page: Top action buttons must not be visible
    await expect(page.locator('#btn-collect-payment-top')).not.toBeVisible();
    await expect(page.locator('#btn-create-bill-for-buyer')).not.toBeVisible();

    // 4. Customer Details Page: Edit Buyer button must not be visible
    await expect(page.locator('#btn-edit-buyer')).not.toBeVisible();

    // 5. Customer Details Page: Status toggle button must not be an interactive button
    await expect(page.locator('button.btn-status-toggle')).not.toBeVisible();
    await expect(page.locator('span.btn-status-toggle.static-status')).toBeVisible();

    // 6. Customer Details Page: Statement print button should still be available
    await expect(page.locator('.btn-print-tab')).toBeVisible();
  });
});

