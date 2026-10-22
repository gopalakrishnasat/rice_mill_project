import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs } from './test-helpers';

const VIEWPORTS = [
  { name: 'Mobile (320x568)', width: 320, height: 568 },
  { name: 'Mobile (375x812)', width: 375, height: 812 },
  { name: 'Mobile (390x844)', width: 390, height: 844 },
  { name: 'Tablet (768x1024)', width: 768, height: 1024 },
  { name: 'Desktop (1366x768)', width: 1366, height: 768 },
  { name: 'Desktop (1440x900)', width: 1440, height: 900 },
  { name: 'Desktop (1920x1080)', width: 1920, height: 1080 },
];

test.describe('08: Multi-Viewport Responsive & Visual Audit', () => {
  for (const vp of VIEWPORTS) {
    test(`TC-RESP-${vp.width}x${vp.height}: Dashboard responsive layout at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginAs(page, TEST_USERS.superAdmin);
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalOverflow, `Horizontal scrollbar detected at ${vp.name}`).toBeFalsy();

      // Check header and titles are visible
      await expect(page.locator('h1.dash-title')).toBeVisible();

      // Check metric cards are properly displayed
      const metricCards = page.locator('.metric-card');
      expect(await metricCards.count()).toBe(4);
    });
  }

  test('TC-VISUAL-01: Login page layout, inputs, and branding visual check', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    // Branding header
    await expect(page.locator('h1.system-title')).toContainText('Rice Mill Management System');
    await expect(page.locator('.mill-name')).toContainText('SRI MAHALAKSHMI RICE MILLS');

    // Input fields styling
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Verify computed styles
    const buttonBg = await page.locator('button[type="submit"]').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(buttonBg).toBeTruthy();
  });

  test('TC-VISUAL-02: Data tables enable horizontal scrolling gracefully on mobile (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, TEST_USERS.superAdmin);

    // Products table
    await page.goto('/products');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.table-responsive, .table-container, table.data-table').first()).toBeVisible();

    // Invoices table
    await page.goto('/invoices');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.table-responsive, .table-container, table.data-table').first()).toBeVisible();

    // Bill Invoices table
    await page.goto('/bill-invoices');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.table-responsive, .table-card').first()).toBeVisible();
  });

  test('TC-VISUAL-03: Printable sheets maintain proper boundaries and Indian Rupee symbols', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, TEST_USERS.superAdmin);

    // Check first GST invoice print
    await page.goto('/invoices');
    await page.waitForSelector('table.data-table tbody tr');
    const printBtn = page.locator('button.btn-print[title="Print Bill"]').first();
    await printBtn.click();
    await page.waitForURL('**/print');

    // Verify printable sheet container
    const gstSheet = page.locator('.printable-sheet');
    await expect(gstSheet).toBeVisible();
    const gstText = await gstSheet.innerText();
    expect(gstText).toContain('₹');

    // Check first Bill Invoice print
    await page.goto('/bill-invoices');
    await page.waitForSelector('table.data-table tbody tr');
    const billPrintLink = page.locator('table.data-table tbody tr a.bill-num-link').first();
    await billPrintLink.click();
    await page.waitForURL('**/bill-invoices/**/print');

    const billSheet = page.locator('.bill-invoice-sheet');
    await expect(billSheet).toBeVisible();
    const billText = await billSheet.innerText();
    expect(billText).toContain('₹');
  });
});
