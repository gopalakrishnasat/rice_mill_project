import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs, clearSession } from './test-helpers';

test.describe('01: Authentication, Authorization & Route Guards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC-AUTH-01: Login page renders with branding, form controls, and title', async ({ page }) => {
    await expect(page).toHaveTitle(/Rice Mill/i);
    await expect(page.locator('h1')).toContainText('Rice Mill Management System');
    
    // Check form fields
    const emailInput = page.locator('input[type="email"], input[formcontrolname="email"]');
    const passwordInput = page.locator('input[type="password"], input[formcontrolname="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText(/Sign In|Login/i);

    // Verify Quick Demo Role Access buttons are removed for production
    await expect(page.locator('.demo-roles-container')).not.toBeVisible();
    await expect(page.locator('body')).not.toContainText('Quick Demo Role Access');
  });

  test('TC-AUTH-02: Form validation triggers on empty submissions, invalid formats, and length', async ({ page }) => {
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const submitBtn = page.locator('#login-submit-btn');

    // 1. Clear fields and submit -> required errors
    await emailInput.fill('');
    await passwordInput.fill('');
    await submitBtn.click();

    const requiredErrors = page.locator('.field-error');
    await expect(requiredErrors.nth(0)).toContainText('Email is required.');
    await expect(requiredErrors.nth(1)).toContainText('Password is required.');

    // 2. Invalid email format
    await emailInput.fill('invalid-email-format');
    await passwordInput.fill('123456');
    await submitBtn.click();
    await expect(page.locator('.field-error').first()).toContainText('valid work email');

    // 3. Password minlength < 6
    await emailInput.fill('admin@ricemill.com');
    await passwordInput.fill('123');
    await submitBtn.click();
    await expect(page.locator('.field-error').first()).toContainText('at least 6 characters');
  });

  test('TC-AUTH-03: Invalid credentials display error alert and do not authenticate', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[formcontrolname="email"]');
    const passwordInput = page.locator('input[type="password"], input[formcontrolname="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await emailInput.fill('invalid_user@ricemill.com');
    await passwordInput.fill('WrongPassword999!');
    await submitBtn.click();

    // Verify error notification or banner
    const alertOrToast = page.locator('.alert-box, .alert-error, .snackbar, .toast, [role="alert"]');
    await expect(alertOrToast.first()).toBeVisible({ timeout: 5000 });
    await expect(alertOrToast.first()).toContainText(/invalid/i);
    // URL remains login
    expect(page.url()).toContain('/login');
  });

  test('TC-AUTH-04: Super Admin login succeeds and redirects to dashboard', async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    expect(page.url()).toContain('/dashboard');
    await expect(page.locator('h1, .dash-title').first()).toBeVisible();
    await expect(page.locator('h1, .dash-title').first()).toContainText(/Operations & Financial/i);
  });

  test('TC-AUTH-05: Unauthenticated access to protected routes redirects to /login', async ({ page }) => {
    await clearSession(page);
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');

    await page.goto('/products');
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');

    await page.goto('/customers');
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');

    await page.goto('/company');
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');

    await page.goto('/users');
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });

  test('TC-AUTH-06: Super Admin can access /company and /users', async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);

    await page.goto('/company');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/company');

    await page.goto('/users');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/users');
  });

  test('TC-AUTH-07: Admin role is restricted from Super Admin routes (/company, /users)', async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);

    await page.goto('/company');
    await page.waitForURL(/dashboard|company/, { timeout: 5000 });
    expect(page.url()).not.toContain('/company');

    await page.goto('/users');
    await page.waitForURL(/dashboard|users/, { timeout: 5000 });
    expect(page.url()).not.toContain('/users');
  });

  test('TC-AUTH-08: Viewer role is restricted from Super Admin routes', async ({ page }) => {
    await loginAs(page, TEST_USERS.viewer);

    await page.goto('/company');
    await page.waitForURL(/dashboard|company/, { timeout: 5000 });
    expect(page.url()).not.toContain('/company');

    await page.goto('/users');
    await page.waitForURL(/dashboard|users/, { timeout: 5000 });
    expect(page.url()).not.toContain('/users');
  });

  test('TC-AUTH-09: Authenticated user accessing /login redirects to /dashboard (guestGuard)', async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);
    await page.goto('/login');
    await page.waitForURL('**/dashboard');
    expect(page.url()).toContain('/dashboard');
  });

  test('TC-AUTH-10: Logout modal confirms session sign-out and redirects to /login', async ({ page }) => {
    await loginAs(page, TEST_USERS.superAdmin);

    const logoutBtn = page.locator('#header-logout-btn');
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();

    // Verify modal is shown
    const confirmBtn = page.locator('#confirm-logout-btn');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    await page.waitForURL('**/login', { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });
});
