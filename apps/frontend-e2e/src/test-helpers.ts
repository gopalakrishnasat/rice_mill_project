import { Page } from '@playwright/test';

export const TEST_USERS = {
  superAdmin: {
    email: 'superadmin@ricemill.com',
    password: 'SuperAdmin@123',
    name: 'Executive Super Admin',
    role: 'SUPER_ADMIN',
  },
  admin: {
    email: 'admin@ricemill.com',
    password: 'Admin@123',
    name: 'Operations Admin',
    role: 'ADMIN',
  },
  viewer: {
    email: 'viewer@ricemill.com',
    password: 'Viewer@123',
    name: 'Auditor Viewer',
    role: 'VIEWER',
  },
};

export async function loginAs(page: Page, user = TEST_USERS.superAdmin) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.locator('input[type="email"], input[formcontrolname="email"]');
  const passwordInput = page.locator('input[type="password"], input[formcontrolname="password"]');

  await emailInput.fill(user.email);
  await passwordInput.fill(user.password);

  const submitButton = page.locator('button[type="submit"]');
  await submitButton.click();

  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
}

export async function clearSession(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('rice_mill_token');
    localStorage.removeItem('rice_mill_user');
    sessionStorage.removeItem('rice_mill_token');
    sessionStorage.removeItem('rice_mill_user');
  });
}
