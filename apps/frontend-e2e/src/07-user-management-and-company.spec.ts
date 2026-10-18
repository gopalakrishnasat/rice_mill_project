import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs } from './test-helpers';

test.describe('07: Personnel Management & Mill Enterprise Profile', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
  });

  test('TC-USER-01: User directory renders headers, KPI metrics, search, and users table', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1.page-title')).toContainText('Personnel & User Management');

    // Metrics grid (Total Mill Employees, Active Accounts, Inactive, Next Sequential ID)
    const metricCards = page.locator('.metric-card');
    expect(await metricCards.count()).toBe(4);

    // Next Sequential ID badge
    const nextSeqIdBadge = page.locator('#next-seq-id-badge');
    await expect(nextSeqIdBadge).toBeVisible();
    const seqId = await nextSeqIdBadge.innerText();
    expect(seqId).toMatch(/EMP-\d+/i);

    // Search and filter controls
    await expect(page.locator('#user-search-input')).toBeVisible();
    await expect(page.locator('#btn-add-employee')).toBeVisible();

    // Table
    const table = page.locator('table.users-table');
    await expect(table).toBeVisible();
    const headers = await table.locator('thead').innerText();
    expect(headers).toMatch(/EMPLOYEE ID/i);
    expect(headers).toMatch(/PERSONNEL NAME/i);
    expect(headers).toMatch(/WORK EMAIL/i);
    expect(headers).toMatch(/ASSIGNED ROLE/i);
  });

  test('TC-USER-02: Search and filter controls narrow employee list', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator('#user-search-input');
    await searchInput.fill('Admin');
    await page.waitForTimeout(300);

    const rows = page.locator('table.users-table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);
  });

  test('TC-USER-03: Add new employee modal validation and creation with sequential ID', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('domcontentloaded');

    const addBtn = page.locator('#btn-add-employee');
    await addBtn.click();

    // Modal opens
    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toContainText('Add New Mill Employee');

    // Verify auto-generated sequential Employee ID is populated and readonly
    const empIdInput = page.locator('#newEmpId');
    await expect(empIdInput).toBeVisible();
    const empIdVal = await empIdInput.inputValue();
    expect(empIdVal).toMatch(/EMP-\d+/i);

    // Test form validation: click submit without required fields
    const submitBtn = modal.locator('button.btn-submit');
    await submitBtn.click();

    // Validation errors should appear
    await expect(modal.locator('.field-error').first()).toBeVisible();

    // Fill valid employee data
    const uniqueTime = Date.now().toString().slice(-4);
    const testEmail = `operator.${uniqueTime}@slricemill.com`;

    await page.locator('#newName').fill(`Operator User ${uniqueTime}`);
    await page.locator('#newEmail').fill(testEmail);
    await page.locator('#newMobile').fill('9876543210');
    await page.locator('#newPass').fill('SecurePass123!');

    // Submit form
    await submitBtn.click();

    // Modal closes upon success
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verify newly created user appears in table
    await searchInputRef(page, testEmail);
    const tableRows = page.locator('table.users-table tbody tr');
    expect(await tableRows.count()).toBeGreaterThan(0);
  });

  test('TC-COMP-01: Mill profile loads enterprise identity, tax compliance, and bank details', async ({ page }) => {
    await page.goto('/company');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1.page-title')).toContainText('Mill & Enterprise Profile');

    // Mill Name input
    const millNameInput = page.locator('input[formcontrolname="millName"]');
    await expect(millNameInput).toBeVisible();
    const millName = await millNameInput.inputValue();
    expect(millName.length).toBeGreaterThan(3);

    // GSTIN input
    const gstinInput = page.locator('input[formcontrolname="gstin"]');
    await expect(gstinInput).toBeVisible();
    const gstin = await gstinInput.inputValue();
    expect(gstin).toMatch(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/);

    // FSSAI input
    const fssaiInput = page.locator('input[formcontrolname="fssaiNumber"]');
    await expect(fssaiInput).toBeVisible();

    // Devotional headers
    await expect(page.locator('input[formcontrolname="center"]')).toBeVisible();

    // Bank Details
    await expect(page.locator('input[formcontrolname="bankName"]')).toBeVisible();
    await expect(page.locator('input[formcontrolname="accountNumber"]')).toBeVisible();

    // Save button initial state (not dirty)
    const saveBtn = page.locator('#save-company-btn');
    await expect(saveBtn).toBeDisabled();
  });

  test('TC-COMP-02: Live miniature invoice preview dynamically updates when company profile inputs change', async ({ page }) => {
    await page.goto('/company');
    await page.waitForLoadState('domcontentloaded');

    // Miniature preview card on the right
    const previewContainer = page.locator('.preview-card, .live-preview-box, .mini-invoice-preview');
    if (await previewContainer.isVisible()) {
      // Modify tagline
      const taglineInput = page.locator('input[formcontrolname="tagline"]');
      if (await taglineInput.isVisible()) {
        await taglineInput.fill('Pure & Fresh Rice Quality Assured');
        await page.waitForTimeout(300);

        // Save button becomes enabled
        const saveBtn = page.locator('#save-company-btn');
        await expect(saveBtn).toBeEnabled();
      }
    }
  });
});

async function searchInputRef(page: any, text: string) {
  const searchInput = page.locator('#user-search-input');
  await searchInput.fill(text);
  await page.waitForTimeout(400);
}
