import { test, expect } from '@playwright/test';

async function httpJson(url: string, opts: any = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`Non-JSON from ${url}: ${text}`);
  }
  return { status: res.status, data };
}

test('portal download flow', async ({ page }) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';
  const ordersBase = process.env.ORDERS_BASE || 'http://localhost:14002';

  // Signup to get token
  const email = `e2e-labels-${Date.now()}@example.com`;
  const password = 'password123';
  const tenantName = `Acme ${Date.now()}`;
  const signupMutation = `mutation Signup($input: SignupInput!) { signup(input: $input) { token } }`;
  const signup = await httpJson(apiUrl, {
    method: 'POST',
    body: JSON.stringify({
      query: signupMutation,
      variables: { input: { email, password, tenantName } },
    }),
  });
  const token = signup.data?.data?.signup?.token as string;
  expect(token).toBeTruthy();

  // Ingest order
  const ext = `LBL-${Date.now()}`;
  const order = { channel: 'shopify', externalId: ext, items: [{ sku: 'SKU-1', quantity: 1 }] };
  const ingest = await httpJson(`${ordersBase}/v1/orders/ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(order),
  });
  expect([200, 201]).toContain(ingest.status);

  // Create return
  const list = await httpJson(`${ordersBase}/v1/orders?page=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const orderId = list.data?.items?.[0]?.id as string;
  const created = await httpJson(`${ordersBase}/v1/returns`, {
    method: 'POST',
    body: JSON.stringify({ orderId, reason: 'damaged' }),
  });
  expect([200, 201]).toContain(created.status);
  const returnId = created.data?.id as string;
  expect(returnId).toBeTruthy();

  // Open dashboard and generate label
  await page.goto('/returns');
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  await page.reload();
  await page.getByLabel('Return ID:').fill(returnId);
  await page.getByRole('button', { name: /load/i }).click();
  // Create label if not already there
  const createBtn = page.getByRole('button', { name: /create return label/i });
  if (await createBtn.isVisible()) {
    await createBtn.click();
  }
  const link = page.getByRole('link', { name: /download/i });
  await expect(link).toBeVisible({ timeout: 20000 });
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^http/);
});
