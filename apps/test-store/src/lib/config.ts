export function getConfig() {
  const ORDERS_URL = process.env.ORDERS_URL || 'http://localhost:4002';
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
  const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'test-tenant-1';
  const DEFAULT_CHANNEL = process.env.DEFAULT_CHANNEL || 'test-store';
  return { ORDERS_URL, JWT_SECRET, TEST_TENANT_ID, DEFAULT_CHANNEL };
}
