import { useEffect, useMemo, useState } from 'react';

type Return = { id: string; orderId: string; state: string; reason: string; createdAt: string };
type Label = { id: string; returnId: string; carrier: string; service: string; costCents: number; currency: string; downloadUrl: string; createdAt: string };

export default function ReturnsPage() {
  const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql', []);
  const [token, setToken] = useState<string | null>(null);
  const [returnIdInput, setReturnIdInput] = useState('');
  const [data, setData] = useState<Return | null>(null);
  const [label, setLabel] = useState<Label | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem('token'));
  }, []);

  async function fetchReturn(id: string) {
    setLoading(true);
    setError(null);
    try {
      const query = `query ReturnById($id: ID!) { returnById(id: $id) { id orderId state reason createdAt } }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ query, variables: { id } }),
      });
      const json = await res.json();
      const r = json?.data?.returnById as Return | undefined;
      if (!r) throw new Error(json?.errors?.[0]?.message || 'Not found');
      setData(r);
      await fetchLabel(id);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
      setData(null);
      setLabel(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLabel(id: string) {
    const query = `query LabelByReturn($id: ID!) { labelByReturn(returnId: $id) { id returnId carrier service costCents currency downloadUrl createdAt } }`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
      body: JSON.stringify({ query, variables: { id } }),
    });
    const json = await res.json();
    setLabel(json?.data?.labelByReturn || null);
  }

  async function createLabel() {
    if (!data?.id) return;
    setLoading(true);
    setError(null);
    try {
      const mutation = `mutation Gen($returnId: ID!) { generateReturnLabel(returnId: $returnId) { id returnId carrier service costCents currency downloadUrl createdAt } }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ query: mutation, variables: { returnId: data.id } }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Failed to create');
      setLabel(json.data.generateReturnLabel);
    } catch (e: any) {
      setError(e.message || 'Failed to create label');
    } finally {
      setLoading(false);
    }
  }

  if (typeof window === 'undefined') return null as any;
  if (!token) {
    window.location.href = '/login';
    return null as any;
  }
  return (
    <main style={{ padding: 24 }}>
      <h1>Returns</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ marginBottom: 16 }}>
        <label>
          Return ID:
          <input style={{ marginLeft: 8 }} value={returnIdInput} onChange={(e) => setReturnIdInput(e.target.value)} />
        </label>
        <button style={{ marginLeft: 8 }} disabled={!returnIdInput || loading} onClick={() => fetchReturn(returnIdInput)}>Load</button>
      </div>
      {data && (
        <div>
          <p><strong>Return:</strong> {data.id}</p>
          <p><strong>State:</strong> {data.state}</p>
          {label ? (
            <p>
              <strong>Label:</strong> <a href={label.downloadUrl} target="_blank" rel="noreferrer">Download</a> ({label.carrier} {label.service}, {(label.costCents/100).toFixed(2)} {label.currency})
            </p>
          ) : (
            <button onClick={createLabel} disabled={loading}>Create Return Label</button>
          )}
        </div>
      )}
    </main>
  );
}

