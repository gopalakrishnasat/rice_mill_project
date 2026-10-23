import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs, clearSession } from './test-helpers';

test.describe('03: Products Catalog Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-PROD-01: Products page renders catalog title, metric cards, and table', async ({ page }) => {
    await expect(page.locator('h1.page-title')).toContainText('Products & Variety Catalog');

    // Metrics grid
    const metricCards = page.locator('.metric-card');
    expect(await metricCards.count()).toBe(4);

    // Table
    const table = page.locator('.products-table, table');
    await expect(table.first()).toBeVisible();

    // Table headers
    const headersText = await table.first().locator('thead').innerText();
    expect(headersText).toMatch(/PRODUCT \/ VARIETY NAME/i);
    expect(headersText).toMatch(/CATEGORY/i);
    expect(headersText).toMatch(/HSN/i);
    expect(headersText).toMatch(/PACKAGE/i);
    expect(headersText).toMatch(/RATE/i);
    expect(headersText).toMatch(/STATUS/i);
  });

  test('TC-PROD-02: Search filter filters products by name, code, or HSN', async ({ page }) => {
    const searchInput = page.locator('#product-search-input');
    await expect(searchInput).toBeVisible();

    // Search for a common term like '1006' or 'Rice'
    await searchInput.fill('1006');
    await page.waitForTimeout(300);

    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);
  });

  test('TC-PROD-03: Category filter pills filter catalog items', async ({ page }) => {
    const filterPills = page.locator('.filter-pill');
    await expect(filterPills.first()).toBeVisible();

    // Click By-Products
    const byProductPill = filterPills.filter({ hasText: /By-Products/i });
    if (await byProductPill.isVisible()) {
      await byProductPill.click();
      await expect(byProductPill).toHaveClass(/active/);
    }

    // Switch back to All Categories
    const allPill = filterPills.filter({ hasText: /All Categories/i });
    await allPill.click();
    await expect(allPill).toHaveClass(/active/);
  });

  test('TC-PROD-04: Add product modal validates required fields', async ({ page }) => {
    await page.waitForSelector('tbody tr');
    const addBtn = page.locator('#btn-add-product');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Modal opens
    const modal = page.locator('.modal-container');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toContainText(/Add New Product/i);

    // Clear name and submit
    const nameInput = modal.locator('input[formcontrolname="name"]');
    await nameInput.fill('');
    const submitBtn = modal.locator('button[type="submit"]');
    await submitBtn.click();

    // Verify modal error banner
    const modalError = modal.locator('.modal-alert-error');
    await expect(modalError).toBeVisible();
    await expect(modalError).toContainText(/required fields/i);

    // Close modal
    await modal.locator('.btn-modal-close').click();
    await expect(modal).not.toBeVisible();
  });

  test('TC-PROD-05: Create new product, edit it, and toggle status', async ({ page }) => {
    await page.waitForSelector('tbody tr');
    const addBtn = page.locator('#btn-add-product');
    await addBtn.click();

    const modal = page.locator('.modal-container');
    await expect(modal).toBeVisible();

    const testUnique = Date.now().toString().slice(-4);
    const testProductName = `QA Sona Masoori Test ${testUnique}`;

    // Verify Product Code is non-editable and auto-generated
    const codeInput = modal.locator('input[formcontrolname="productCode"]');
    await expect(codeInput).toHaveAttribute('readonly');
    const autoCode = await codeInput.inputValue();
    expect(autoCode).toMatch(/^PROD-\d+/i);

    // Fill remaining form fields
    await modal.locator('input[formcontrolname="name"]').fill(testProductName);
    await modal.locator('input[formcontrolname="bagWeightKg"]').fill('25');
    await modal.locator('input[formcontrolname="defaultRate"]').fill('1250');
    await modal.locator('select[formcontrolname="taxRatePercent"]').selectOption('5');

    // Submit
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verify product appears in table
    const searchInput = page.locator('#product-search-input');
    await searchInput.fill(testProductName);
    await page.waitForTimeout(500);

    const productRow = page.locator(`tr:has-text("${testProductName}")`);
    await expect(productRow).toBeVisible();
    await expect(productRow).toContainText('₹1,250.00');

    // Edit Product
    const editBtn = productRow.locator('.btn-action-edit');
    await editBtn.click();
    await expect(modal).toBeVisible();

    // Update rate
    await modal.locator('input[formcontrolname="defaultRate"]').fill('1300');
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verify updated rate
    await expect(productRow).toContainText('₹1,300.00');

    // Toggle Status
    const statusPill = productRow.locator('.status-pill');
    await expect(statusPill).toContainText('Active');
    await statusPill.click();

    // Confirm dialog if shown
    const confirmModal = page.locator('.confirm-dialog-modal, .confirm-modal, app-confirm-dialog');
    if (await confirmModal.locator('.btn-confirm, #confirm-dialog-btn').first().isVisible()) {
      await confirmModal.locator('.btn-confirm, #confirm-dialog-btn').first().click();
    }
    await page.waitForTimeout(500);
  });

  test('TC-PROD-06: Viewer role has read-only access and cannot see Add Product button', async ({ page }) => {
    await clearSession(page);
    await loginAs(page, TEST_USERS.viewer);
    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1.page-title')).toBeVisible();
    const addBtn = page.locator('#btn-add-product');
    await expect(addBtn).not.toBeVisible();

    // Create New Bill button in products header should also not be visible for View-Only Admin
    await expect(page.locator('#btn-create-bill-from-products')).not.toBeVisible();

    const editBtns = page.locator('.btn-action-edit');
    expect(await editBtns.count()).toBe(0);

    // Clicking product row must NOT open edit modal for View-Only Admin
    const firstRow = page.locator('table.data-table tbody tr').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page.locator('.modal-backdrop')).not.toBeVisible();
  });
});

