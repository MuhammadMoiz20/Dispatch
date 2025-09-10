import { test, expect } from '@playwright/test';

test('signup redirects to orders and stores token', async ({ page, baseURL }) => {
  const url = new URL(baseURL!);
  // Navigate to signup
  await page.goto('/signup');

  const email = `e2e-${Date.now()}@example.com`;
  const password = 'password123';
  const tenantName = `Acme ${Date.now()}`;

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Tenant Name').fill(tenantName);

  await Promise.all([
    page.waitForURL('**/orders'),
    page.getByRole('button', { name: /sign up/i }).click(),
  ]);

  // Token should be in localStorage
  const token = await page.evaluate(() => window.localStorage.getItem('token'));
  expect(token).toBeTruthy();
  expect(token!.length).toBeGreaterThan(20);
});
