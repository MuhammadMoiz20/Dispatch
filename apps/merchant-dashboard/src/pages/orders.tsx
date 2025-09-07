import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql', []);

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
        body: JSON.stringify({ query, variables: { page: p, pageSize, status: status || undefined, channel: channel || undefined } }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Orders</h1>
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
          <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="created/shipped/etc" style={{ marginLeft: 4 }} />
        </label>
        <label style={{ marginRight: 8 }}>
          Channel:
          <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="shopify/amazon/etc" style={{ marginLeft: 4 }} />
        </label>
        <button onClick={() => fetchOrders({ page: 1 })} disabled={loading}>
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
            <th>Channel</th>
            <th>External ID</th>
            <th>Status</th>
            <th>Items</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{o.channel}</td>
              <td>{o.externalId}</td>
              <td>{o.status}</td>
              <td>{o.itemsCount}</td>
              <td>{new Date(o.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {items.length === 0 && !loading && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center' }}>
                No orders found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button disabled={page <= 1 || loading} onClick={() => fetchOrders({ page: page - 1 })}>
          Prev
        </button>
        <span>
          Page {page} / {totalPages} ({total} total)
        </span>
        <button disabled={page >= totalPages || loading} onClick={() => fetchOrders({ page: page + 1 })}>
          Next
        </button>
      </div>

      <p style={{ marginTop: 16 }}>
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
