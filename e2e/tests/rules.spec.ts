import { test, expect } from '@playwright/test';

test('dashboard rules CRUD', async ({ page }) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';
  const dashboardBase = process.env.E2E_DASHBOARD_BASE_URL || 'http://localhost:3001';
  // Signup to get a token
  const email = `e2e-rules-${Date.now()}@example.com`;
  const password = 'password123';
  const tenantName = `Acme Rules ${Date.now()}`;
  const signupMutation = `mutation Signup($input: SignupInput!) { signup(input: $input) { token } }`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: signupMutation, variables: { input: { email, password, tenantName } } }),
  });
  const json = await res.json();
  const token = json?.data?.signup?.token;
  expect(token).toBeTruthy();

  // Go to dashboard /rules and create a rule
  await page.goto(dashboardBase + '/rules');
  // Inject token into localStorage for auth
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  await page.reload();

  await page.getByRole('button', { name: /create/i }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText(/Create Rule/i)).toBeVisible();
  // The default form has a valid rule; creating should add it to the table
  await page.getByRole('button', { name: /^Create$/ }).click();
  await expect(page.getByText(/Auto-approve wrong-size/i)).toBeVisible({ timeout: 10000 });
});

