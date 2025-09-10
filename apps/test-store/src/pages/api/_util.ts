import jwt from 'jsonwebtoken';
import { getConfig } from '../../lib/config';

export function makeAuthToken() {
  const { JWT_SECRET, TEST_TENANT_ID } = getConfig();
  // Include a userId marker so downstream logs can identify the source
  return jwt.sign({ tenantId: TEST_TENANT_ID, userId: 'test-store' }, JWT_SECRET, {
    expiresIn: '5m',
  });
}

export async function maybeDelay(ms?: number) {
  if (!ms || ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

export function shouldFail(rate?: number) {
  if (!rate || rate <= 0) return false;
  if (rate >= 1) return true;
  return Math.random() < rate;
}

export function ensureExternalId(base?: string) {
  return base && base.trim()
    ? base.trim()
    : `TEST-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}
