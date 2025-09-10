import type { NextApiRequest, NextApiResponse } from 'next';
import { getConfig } from '../../lib/config';
import { ensureExternalId, makeAuthToken, maybeDelay, shouldFail } from './_util';

type Item = { sku: string; quantity: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { ORDERS_URL } = getConfig();
  const token = makeAuthToken();

  const body = req.body || {};
  const channel: string = (body.channel || process.env.DEFAULT_CHANNEL || 'test-store').toString();
  const externalId: string = ensureExternalId(body.externalId);
  const items: Item[] = Array.isArray(body.items) ? body.items : [];
  const options = body.options || {};

  try {
    await maybeDelay(options.delayMs);
    if (shouldFail(options.failRate)) {
      return res.status(500).json({ error: 'Simulated failure (failRate)' });
    }

    const upstreamResp = await fetch(`${ORDERS_URL}/v1/orders/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, externalId, items }),
    });
    const data = await upstreamResp.json().catch(() => ({}));

    // If duplicate flag set, send the same externalId once more for idempotency test
    let duplicateResult: any = null;
    if (options.duplicate) {
      const dResp = await fetch(`${ORDERS_URL}/v1/orders/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ channel, externalId, items }),
      });
      duplicateResult = await dResp.json().catch(() => ({}));
    }

    return res.status(upstreamResp.status).json({
      upstreamStatus: upstreamResp.status,
      created: data?.created ?? null,
      orderId: data?.orderId ?? null,
      channel,
      externalId,
      itemsCount: items.length,
      duplicateResult,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to send order' });
  }
}
