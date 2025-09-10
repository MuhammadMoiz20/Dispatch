import type { NextApiRequest, NextApiResponse } from 'next';
import { getConfig } from '../../lib/config';
import { makeAuthToken } from './_util';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { ORDERS_URL } = getConfig();
  const token = makeAuthToken();
  const url = new URL(`${ORDERS_URL}/v1/orders`);
  const { page, pageSize, status, channel } = req.query as Record<string, string | undefined>;
  if (page) url.searchParams.set('page', page);
  if (pageSize) url.searchParams.set('pageSize', pageSize);
  if (status) url.searchParams.set('status', status);
  if (channel) url.searchParams.set('channel', channel);
  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json().catch(() => ({}));
    return res.status(resp.status).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to list orders' });
  }
}
