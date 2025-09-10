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

test('returns portal initiate flow', async ({ page }) => {
  // Ensure an order exists by signing up -> token -> ingest one order
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';
  const ordersBase = process.env.ORDERS_BASE || 'http://localhost:14002';
  const email = `e2e-rp-${Date.now()}@example.com`;
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
  const token = signup.data?.data?.signup?.token;
  expect(token).toBeTruthy();

  const ext = `RP-${Date.now()}`;
  const order = { channel: 'shopify', externalId: ext, items: [{ sku: 'SKU-1', quantity: 1 }] };
  const ingest = await httpJson(`${ordersBase}/v1/orders/ingest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(order),
  });
  expect([200, 201]).toContain(ingest.status);

  // Navigate to portal and initiate return using new order id
  const portalBase = process.env.E2E_PORTAL_BASE_URL || 'http://localhost:3002';
  await page.goto(portalBase + '/');
  const orderList = await httpJson(`${ordersBase}/v1/orders?page=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const createdId = orderList.data?.items?.[0]?.id;
  expect(createdId).toBeTruthy();

  await page.getByLabel('Order ID').fill(createdId);
  await page.getByLabel('Reason').fill('damaged');
  const waitGql = page.waitForResponse(
    (r) => r.url().includes('/graphql') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /start return/i }).click();
  const gqlResp = await waitGql;
  expect(gqlResp.status()).toBeLessThan(400);
  await page.waitForURL('**/return/*', { timeout: 120000 });

  // Status page should show initiated state
  await expect(page.getByText('State:')).toBeVisible();
  await expect(page.getByText(/initiated/i)).toBeVisible();
});
