import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { VirtualTable, Chip, Tooltip } from '@dispatch/ui';
import { makeWsClient, subscribe } from '../lib/subscriptions';
import { useRouter } from 'next/router';

type Order = {
  id: string;
  channel: string;
  externalId: string;
  status: string;
  createdAt: string;
  itemsCount: number;
};

export default function Orders() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql',
    [],
  );

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!t) router.replace('/login');
    setToken(t);
  }, [router]);

  async function fetchOrders(opts?: { page?: number }) {
    if (!token) return;
    const p = opts?.page ?? page;
    setLoading(true);
    setError(null);
    try {
      const query = `query Orders($page: Int, $pageSize: Int, $status: String, $channel: String) {
        orders(page: $page, pageSize: $pageSize, status: $status, channel: $channel) {
          items { id channel externalId status createdAt itemsCount }
          page pageSize total
        }
      }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query,
          variables: {
            page: p,
            pageSize,
            status: status || undefined,
            channel: channel || undefined,
          },
        }),
      });
      if (res.status === 401) {
        setError('Unauthorized: please log in again');
        router.replace('/login');
        return;
      }
      if (res.status === 403) {
        setError('Forbidden: your token lacks access');
        return;
      }
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message || 'GraphQL error');
      const data = json.data.orders;
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void fetchOrders({ page: 1 });
    if (!token) return;
    // Live updates: refetch on new order events
    const client = makeWsClient(token);
    const q = `subscription { orderCreated { orderId channel externalId at } }`;
    const dispose = subscribe(client, q, {}, () => {
      void fetchOrders({ page: 1 });
    });
    return () => {
      try {
        dispose();
      } catch (e) {
        console.error(e);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders</h1>
      </div>
      <div className="card">
        <div className="card-body flex flex-wrap items-end gap-3">
          <label className="text-sm flex items-center">
            <span className="text-gray-600 dark:text-gray-300">Status</span>
            <Tooltip tip="Filter by order status. e.g. created, shipped, delivered.">
              <span
                aria-hidden
                className="ml-1 inline-block w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-center leading-4"
              >
                i
              </span>
            </Tooltip>
            <input
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="created/shipped/etc"
              className="mt-1 ml-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">Channel</span>
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="shopify/amazon/etc"
              className="mt-1 ml-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1"
            />
          </label>
          <button
            onClick={() => fetchOrders({ page: 1 })}
            disabled={loading}
            className="btn-primary"
          >
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="card-body text-red-600">
            Error: {error}{' '}
            {error?.toLowerCase().includes('unauthorized') && (
              <Link href="/login" className="ml-2 underline">
                Go to login
              </Link>
            )}
          </div>
        </div>
      )}

      <VirtualTable
        ariaLabel="Orders table"
        rows={items.map((o) => ({ ...o, id: o.id }))}
        columns={[
          {
            key: 'id',
            header: 'ID',
            width: 220,
            render: (r) => <code className="text-xs">{r.id}</code>,
          },
          { key: 'channel', header: 'Channel', width: 140 },
          { key: 'externalId', header: 'External ID', width: 180 },
          {
            key: 'status',
            header: 'Status',
            width: 160,
            render: (r) => (
              <Chip
                tone={
                  r.status === 'shipped' || r.status === 'delivered'
                    ? 'success'
                    : r.status === 'cancelled'
                      ? 'danger'
                      : 'neutral'
                }
              >
                {r.status}
              </Chip>
            ),
          },
          { key: 'itemsCount', header: 'Items', width: 100 },
          {
            key: 'createdAt',
            header: 'Created',
            width: 220,
            render: (r) => new Date(r.createdAt).toLocaleString(),
          },
        ]}
        height={520}
      />

      <div className="flex items-center gap-3">
        <button
          disabled={page <= 1 || loading}
          onClick={() => fetchOrders({ page: page - 1 })}
          className="btn-secondary"
        >
          Prev
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Page {page} / {totalPages} ({total} total)
        </span>
        <button
          disabled={page >= totalPages || loading}
          onClick={() => fetchOrders({ page: page + 1 })}
          className="btn-secondary"
        >
          Next
        </button>
      </div>

      <p className="text-sm">
        <Link href="/" className="text-gray-600 dark:text-gray-300">
          Back to Home
        </Link>
      </p>
    </div>
  );
}
