import type { NextApiRequest, NextApiResponse } from 'next';
import { getConfig } from '../../lib/config';
import { ensureExternalId, makeAuthToken } from './_util';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { ORDERS_URL } = getConfig();
  const token = makeAuthToken();
  const body = req.body || {};
  const count = Math.max(1, Math.min(1000, parseInt(body.count || '1', 10)));
  const base = body.base || {};
  const channel: string = (base.channel || process.env.DEFAULT_CHANNEL || 'test-store').toString();
  const items: any[] = Array.isArray(base.items) ? base.items : [];

  const results: any[] = [];
  for (let i = 0; i < count; i++) {
    const extId = ensureExternalId(base.externalId);
    try {
      const resp = await fetch(`${ORDERS_URL}/v1/orders/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel, externalId: extId, items }),
      });
      const data = await resp.json().catch(() => ({}));
      results.push({
        status: resp.status,
        orderId: data?.orderId || null,
        created: data?.created ?? null,
        externalId: extId,
      });
    } catch (e: any) {
      results.push({ status: 500, error: e?.message || 'failed', externalId: extId });
    }
  }

  return res.status(200).json({ count, results });
}
