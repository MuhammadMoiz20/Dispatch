import { useEffect, useState } from 'react';

type Order = {
  id: string;
  channel: string;
  externalId: string;
  status: string;
  createdAt: string;
  itemsCount: number;
};

export default function Orders() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/orders');
      const data = await resp.json();
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container">
      <h1>Orders</h1>
      <div style={{ marginBottom: 8 }}>
        <button onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <div className="card">
        {loading ? (
          <div>Loading...</div>
        ) : items.length === 0 ? (
          <div>No orders found</div>
        ) : (
          <table cellPadding={6}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Channel</th>
                <th>External ID</th>
                <th>Status</th>
                <th>Created</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.channel}</td>
                  <td>{o.externalId}</td>
                  <td>{o.status}</td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                  <td>{o.itemsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
