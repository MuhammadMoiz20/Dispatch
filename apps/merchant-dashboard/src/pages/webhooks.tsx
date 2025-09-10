import { useEffect, useMemo, useState } from 'react';
import { makeWsClient, subscribe } from '../lib/subscriptions';
import { useRouter } from 'next/router';

type Delivery = {
  id: string;
  endpointId: string;
  eventType: string;
  status: string;
  attempts: number;
  responseStatus?: number | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt?: string | null;
};

export default function Webhooks() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<Delivery[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [endpointId, setEndpointId] = useState('');
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

  async function fetchDeliveries(opts?: { page?: number }) {
    if (!token) return;
    const p = opts?.page ?? page;
    setLoading(true);
    setError(null);
    try {
      const query = `query Deliveries($page: Int, $pageSize: Int, $status: String, $endpointId: String) {
        deliveries(page: $page, pageSize: $pageSize, status: $status, endpointId: $endpointId) {
          items { id endpointId eventType status attempts responseStatus lastError createdAt updatedAt nextAttemptAt }
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
            endpointId: endpointId || undefined,
          },
        }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      const data = json.data.deliveries;
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
    if (token) void fetchDeliveries({ page: 1 });
    if (!token) return;
    // Live updates: refetch on webhook delivery updates
    const client = makeWsClient(token);
    const q = `subscription { webhookDeliveryUpdated { deliveryId status attempts at } }`;
    const dispose = subscribe(client, q, {}, () => {
      void fetchDeliveries();
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

  async function replay(id: string) {
    if (!token) return;
    try {
      const mutation = `mutation Replay($id: String!) { replayDelivery(id: $id) }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: mutation, variables: { id } }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      await fetchDeliveries();
    } catch (e: any) {
      alert(e.message || 'Replay failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Webhooks</h1>
      </div>
      <div className="card">
        <div className="card-body flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">Status</span>
            <input
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="pending/delivered/etc"
              className="mt-1 ml-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">Endpoint ID</span>
            <input
              value={endpointId}
              onChange={(e) => setEndpointId(e.target.value)}
              placeholder="endpoint id"
              className="mt-1 ml-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1"
            />
          </label>
          <button
            onClick={() => fetchDeliveries({ page: 1 })}
            disabled={loading}
            className="btn-primary"
          >
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="card-body text-red-600">Error: {error}</div>
        </div>
      )}

      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300">
                <th className="py-2">ID</th>
                <th className="py-2">Endpoint</th>
                <th className="py-2">Event</th>
                <th className="py-2">Status</th>
                <th className="py-2">Attempts</th>
                <th className="py-2">Resp</th>
                <th className="py-2">Next Attempt</th>
                <th className="py-2">Created</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-2 font-mono text-xs">{d.id}</td>
                  <td className="py-2">{d.endpointId}</td>
                  <td className="py-2">{d.eventType}</td>
                  <td className="py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                      {d.status}
                    </span>
                  </td>
                  <td className="py-2">{d.attempts}</td>
                  <td className="py-2">{d.responseStatus ?? '-'}</td>
                  <td className="py-2">
                    {d.nextAttemptAt ? new Date(d.nextAttemptAt).toLocaleString() : '-'}
                  </td>
                  <td className="py-2">{new Date(d.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <button
                      onClick={() => replay(d.id)}
                      disabled={loading}
                      className="btn-secondary"
                    >
                      Replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={page <= 1 || loading}
          onClick={() => fetchDeliveries({ page: page - 1 })}
          className="btn-secondary"
        >
          Prev
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Page {page} / {totalPages} ({total} total)
        </span>
        <button
          disabled={page >= totalPages || loading}
          onClick={() => fetchDeliveries({ page: page + 1 })}
          className="btn-secondary"
        >
          Next
        </button>
      </div>
    </div>
  );
}
