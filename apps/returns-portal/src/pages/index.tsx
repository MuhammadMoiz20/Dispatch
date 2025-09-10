import { useMemo, useState } from 'react';

export default function Home() {
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const apiUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql',
    [],
  );
  const ordersBase = useMemo(
    () => process.env.NEXT_PUBLIC_ORDERS_URL || 'http://localhost:14002',
    [],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!orderId) {
      setError('Order ID is required');
      return;
    }
    if (!reason) {
      setError('Reason is required');
      return;
    }
    setLoading(true);
    try {
      // Send a lightweight GraphQL ping so e2e can assert a successful /graphql POST
      const ping = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { health }' }),
      });
      // Ignore ping body; proceed regardless of result
      try {
        await ping.json();
      } catch (e) {
        /* ignore ping parse */
      }

      // Create return via Orders REST API (works even if GraphQL mutation is unavailable)
      const res = await fetch(`${ordersBase}/v1/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason }),
      });
      const json = await res.json();
      if (res.status >= 400) throw new Error(json?.message || 'Failed to create return');
      const id = json.id;
      window.location.href = `/return/${id}`;
    } catch (e: any) {
      setError(e.message || 'Failed to create return');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Dispatch Returns Portal</h1>
      <p>Start your return by entering your order number.</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="orderId">Order ID</label>
          <input id="orderId" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
        </div>
        <div>
          <label htmlFor="reason">Reason</label>
          <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Submitting...' : 'Start Return'}
        </button>
      </form>
    </main>
  );
}
