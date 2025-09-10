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

async function ingestOrder(token: string, order: any) {
  const bases = [process.env.ORDERS_BASE, 'http://localhost:14002', 'http://localhost:4002'].filter(
    Boolean,
  ) as string[];
  let lastErr: any;
  for (const base of bases) {
    try {
      const res = await httpJson(`${base}/v1/orders/ingest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(order),
      });
      if (res.status < 400) return res;
      lastErr = new Error(`HTTP ${res.status} ${JSON.stringify(res.data)}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

test('orders list renders after signup and ingest', async ({ page, baseURL }) => {
  await page.goto('/signup');
  const email = `e2e-orders-${Date.now()}@example.com`;
  const password = 'password123';
  const tenantName = `Acme ${Date.now()}`;

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Tenant Name').fill(tenantName);

  await Promise.all([
    page.waitForURL('**/orders'),
    page.getByRole('button', { name: /sign up/i }).click(),
  ]);

  const token = await page.evaluate(() => window.localStorage.getItem('token'));
  expect(token).toBeTruthy();

  // Ingest a couple of orders for this tenant via service API
  const ext = `E2E-${Date.now()}`;
  const orders = [1, 2, 3].map((i) => ({
    channel: 'shopify',
    externalId: `${ext}-${i}`,
    items: [
      { sku: `SKU-${i}`, quantity: 1 },
      { sku: `SKU-${i}-B`, quantity: 2 },
    ],
  }));
  for (const o of orders) {
    await ingestOrder(token!, o);
  }

  // Refresh list
  await page.reload();
  await page.getByRole('button', { name: /apply/i }).click();

  // Expect at least one of our external IDs visible
  await expect(page.getByText(orders[0].externalId)).toBeVisible();
});
