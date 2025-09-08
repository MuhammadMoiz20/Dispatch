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

  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql', []);

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
        body: JSON.stringify({ query, variables: { page: p, pageSize, status: status || undefined, endpointId: endpointId || undefined } }),
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
      try { dispose(); } catch {}
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
    <main style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Webhooks</h1>
        <button
          onClick={() => {
            localStorage.removeItem('token');
            router.replace('/login');
          }}
        >
          Logout
        </button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginRight: 8 }}>
          Status:
          <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="pending/delivered/etc" style={{ marginLeft: 4 }} />
        </label>
        <label style={{ marginRight: 8 }}>
          Endpoint ID:
          <input value={endpointId} onChange={(e) => setEndpointId(e.target.value)} placeholder="endpoint id" style={{ marginLeft: 4 }} />
        </label>
        <button onClick={() => fetchDeliveries({ page: 1 })} disabled={loading}>
          Apply
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: 12 }}>Error: {error}</div>
      )}

      <table border={1} cellPadding={8} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Endpoint</th>
            <th>Event</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Resp</th>
            <th>Next Attempt</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id}>
              <td>{d.id}</td>
              <td>{d.endpointId}</td>
              <td>{d.eventType}</td>
              <td>{d.status}</td>
              <td>{d.attempts}</td>
              <td>{d.responseStatus ?? '-'}</td>
              <td>{d.nextAttemptAt ? new Date(d.nextAttemptAt).toLocaleString() : '-'}</td>
              <td>{new Date(d.createdAt).toLocaleString()}</td>
              <td>
                <button onClick={() => replay(d.id)} disabled={loading}>
                  Replay
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button disabled={page <= 1 || loading} onClick={() => fetchDeliveries({ page: page - 1 })}>
          Prev
        </button>
        <span>
          Page {page} / {totalPages} ({total} total)
        </span>
        <button disabled={page >= totalPages || loading} onClick={() => fetchDeliveries({ page: page + 1 })}>
          Next
        </button>
      </div>
    </main>
  );
}
