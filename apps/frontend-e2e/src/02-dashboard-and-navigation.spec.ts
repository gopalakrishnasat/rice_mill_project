import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs } from './test-helpers';

test.describe('02: Dashboard & Navigation Layout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
  });

  test('TC-DASH-01: Header renders mill brand, role badge, profile link, and navigation controls', async ({ page }) => {
    const header = page.locator('header.topbar');
    await expect(header).toBeVisible();

    // Brand title in header
    await expect(header.locator('.brand-title')).toBeVisible();

    // User badge
    const userBadge = header.locator('.user-badge-container');
    await expect(userBadge).toBeVisible();
    await expect(userBadge).toContainText('Executive Super Admin');
    await expect(userBadge).toContainText('SUPER_ADMIN');

    // Mill Profile link for Super Admin
    const millProfileBtn = page.locator('#header-mill-profile-btn');
    await expect(millProfileBtn).toBeVisible();
  });

  test('TC-DASH-02: Sidebar navigation links are present and navigate correctly', async ({ page }) => {
    const sidebar = page.locator('aside.sidebar, .sidebar');
    await expect(sidebar).toBeVisible();

    // Check all expected links
    const dashboardLink = sidebar.locator('a[href="/dashboard"], a[routerlink="/dashboard"]');
    const productsLink = sidebar.locator('a[href="/products"], a[routerlink="/products"]');
    const invoicesLink = sidebar.locator('a[href="/invoices"], a[routerlink="/invoices"]');
    const customersLink = sidebar.locator('a[href="/customers"], a[routerlink="/customers"]');
    const usersLink = sidebar.locator('a[href="/users"], a[routerlink="/users"]');
    const billInvoicesLink = sidebar.locator('a[href="/bill-invoices"], a[routerlink="/bill-invoices"]');

    await expect(dashboardLink).toBeVisible();
    await expect(productsLink).toBeVisible();
    await expect(invoicesLink).toBeVisible();
    await expect(customersLink).toBeVisible();
    await expect(usersLink).toBeVisible();
    await expect(billInvoicesLink).toBeVisible();

    // Test navigation to products and back to dashboard
    await productsLink.click();
    await page.waitForURL('**/products');
    expect(page.url()).toContain('/products');

    await dashboardLink.click();
    await page.waitForURL('**/dashboard');
    expect(page.url()).toContain('/dashboard');
  });

  test('TC-DASH-03: Sidebar collapse and expand toggles layout state', async ({ page }) => {
    const toggleBtn = page.locator('#sidebar-toggle-btn');
    const bodyLayout = page.locator('.app-body-layout');

    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(bodyLayout).toHaveClass(/sidebar-collapsed/);

    // Click again to expand
    await toggleBtn.click();
    await expect(bodyLayout).not.toHaveClass(/sidebar-collapsed/);
  });

  test('TC-DASH-04: Dashboard KPI metric cards render with values and labels', async ({ page }) => {
    await expect(page.locator('h1.dash-title')).toBeVisible();

    // Metric cards grid
    const kpiCards = page.locator('.metric-card');
    const count = await kpiCards.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Verify key labels
    const pageText = await page.innerText('.dashboard-wrapper');
    expect(pageText).toMatch(/gross mill turnover/i);
    expect(pageText).toMatch(/amount collected/i);
    expect(pageText).toMatch(/outstanding receivables/i);
    expect(pageText).toMatch(/mill dispatch volume/i);
  });

  test('TC-DASH-05: Period filter pills switch active state without crashing', async ({ page }) => {
    const periodButtons = page.locator('.period-btn');
    await expect(periodButtons.first()).toBeVisible();

    // Click "All Records"
    await periodButtons.filter({ hasText: /All Records/i }).click();
    await expect(periodButtons.filter({ hasText: /All Records/i })).toHaveClass(/active/);

    // Click "Recent 30 Days"
    await periodButtons.filter({ hasText: /Recent 30 Days/i }).click();
    await expect(periodButtons.filter({ hasText: /Recent 30 Days/i })).toHaveClass(/active/);
  });

  test('TC-DASH-06: Quick Action "New Invoice" navigates to invoice creation page', async ({ page }) => {
    const newInvoiceBtn = page.locator('a:has-text("New Invoice"), .btn-new-invoice');
    await expect(newInvoiceBtn.first()).toBeVisible();
    await newInvoiceBtn.first().click();

    await page.waitForURL('**/invoices/new');
    expect(page.url()).toContain('/invoices/new');
    await expect(page.locator('h1.page-title')).toContainText(/Sales Bill|Tax Invoice/i);
  });

  test('TC-DASH-07: Dashboard sections contain deep links to modules', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Deep links
    const catalogLink = page.locator('a:has-text("Catalog →"), a[href="/products"]');
    await expect(catalogLink.first()).toBeVisible();

    const buyersLink = page.locator('a:has-text("All Buyers →"), a[href="/customers"]');
    await expect(buyersLink.first()).toBeVisible();

    const invoicesLink = page.locator('a:has-text("View All →"), a[href="/invoices"]');
    await expect(invoicesLink.first()).toBeVisible();
  });

  test('TC-DASH-08: View-Only Admin cannot see Quick Action "New Invoice" button on Dashboard', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await loginAs(page, TEST_USERS.viewer);
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#dash-btn-new-invoice')).not.toBeVisible();
  });
});

