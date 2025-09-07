#!/usr/bin/env node
/*
 Seed 5 dummy orders for two users via existing APIs.
 - Creates or logs in users via API Gateway GraphQL
 - Ensures passwords match (uses users service dev-set-password in non-prod if needed)
 - Ingests 5 orders per user into Orders service
 Env vars:
   API_URL (default http://localhost:3000/graphql)
   USERS_BASE (default http://localhost:14001, fallback http://localhost:4001)
   ORDERS_BASE (default http://localhost:14002, fallback http://localhost:4002)
*/

const API_URL = process.env.API_URL || 'http://localhost:3000/graphql';
const USERS_BASE_DEFAULTS = [process.env.USERS_BASE, 'http://localhost:14001', 'http://localhost:4001'].filter(Boolean);
const ORDERS_BASE_DEFAULTS = [process.env.ORDERS_BASE, 'http://localhost:14002', 'http://localhost:4002'].filter(Boolean);

async function httpJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`Non-JSON response from ${url}: ${text?.slice(0, 200)}`);
  }
  return { status: res.status, data: json };
}

async function gql(query, variables) {
  const { status, data } = await httpJson(API_URL, {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
  });
  if (status >= 400) throw new Error(`GraphQL HTTP ${status}`);
  if (data.errors?.length) throw new Error(data.errors[0]?.message || 'GraphQL error');
  return data.data;
}

async function tryBases(bases, path, opts) {
  let lastErr;
  for (const base of bases) {
    try {
      const res = await httpJson(`${base}${path}`, opts);
      return { base, ...res };
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  throw new Error('No base URL succeeded');
}

async function ensureUser(email, password) {
  // Try login first
  try {
    const q = `mutation Login($input: LoginInput!) { login(input: $input) { token userId tenantId } }`;
    const out = await gql(q, { input: { email, password } });
    return out.login;
  } catch (e) {
    // continue
  }
  // Try signup
  try {
    const tenantName = email.split('@')[0] + "-tenant";
    const q = `mutation Signup($input: SignupInput!) { signup(input: $input) { token userId tenantId } }`;
    const out = await gql(q, { input: { email, password, tenantName } });
    return out.signup;
  } catch (e) {
    // If signup failed (likely existing user with different password), set password in dev and login
    const body = { email, password };
    const res = await tryBases(USERS_BASE_DEFAULTS, '/v1/auth/dev-set-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.status >= 400) {
      throw new Error(`Failed to set password for ${email}: ${JSON.stringify(res.data)}`);
    }
    const q = `mutation Login($input: LoginInput!) { login(input: $input) { token userId tenantId } }`;
    const out = await gql(q, { input: { email, password } });
    return out.login;
  }
}

function genOrders() {
  const now = Date.now();
  const channels = ['shopify', 'amazon', 'ebay'];
  const orders = [];
  for (let i = 0; i < 5; i++) {
    const channel = channels[i % channels.length];
    orders.push({
      channel,
      externalId: `SEED-${now}-${i + 1}`,
      items: [
        { sku: `SKU-${i + 1}`, quantity: (i % 3) + 1 },
        { sku: `SKU-${i + 1}-B`, quantity: 1 },
      ],
    });
  }
  return orders;
}

async function ingestOrders(token, orders) {
  for (const order of orders) {
    const res = await tryBases(ORDERS_BASE_DEFAULTS, '/v1/orders/ingest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(order),
    });
    if (res.status >= 400) {
      throw new Error(`Ingest failed: HTTP ${res.status} ${JSON.stringify(res.data)}`);
    }
    const created = res.data?.created;
    const id = res.data?.orderId;
    console.log(` - ${order.channel} ${order.externalId}: ${created ? 'created' : 'exists'} (id=${id})`);
  }
}

async function main() {
  const users = [
    { email: 'xyz@gmail.com', password: 'Qwertyui1.' },
    { email: 'xyz2@gmail.com', password: 'Qwertyui1.' },
  ];
  console.log(`API_URL=${API_URL}`);
  console.log(`USERS_BASE candidates: ${USERS_BASE_DEFAULTS.join(', ')}`);
  console.log(`ORDERS_BASE candidates: ${ORDERS_BASE_DEFAULTS.join(', ')}`);

  for (const u of users) {
    console.log(`\nProcessing user ${u.email} ...`);
    const { token, tenantId } = await ensureUser(u.email, u.password);
    console.log(`Authenticated tenantId=${tenantId}`);
    const orders = genOrders();
    await ingestOrders(token, orders);
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error('Seed failed:', e?.message || e);
  process.exit(1);
});

