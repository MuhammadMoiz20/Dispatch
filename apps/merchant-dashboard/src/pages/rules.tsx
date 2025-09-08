import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  condition: any;
  actions: any[];
  createdAt: string;
};

export default function Rules() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rulesBase = useMemo(() => process.env.NEXT_PUBLIC_RULES_BASE || 'http://localhost:14004', []);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!t) router.replace('/login');
    setToken(t);
  }, [router]);

  async function fetchRules() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${rulesBase}/v1/rules`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load rules');
      setItems(data.map((r: any) => ({ ...r, createdAt: new Date(r.createdAt).toISOString() })));
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const [name, setName] = useState('Auto-approve wrong-size');
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(100);
  const [condition, setCondition] = useState('{"all":[{"==":[{"var":"return.reason"},"wrong size"]}] }');
  const [actions, setActions] = useState('[{"type":"approve_return"}]');

  async function createRule() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const cond = JSON.parse(condition);
      const acts = JSON.parse(actions);
      const res = await fetch(`${rulesBase}/v1/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, enabled, priority, condition: cond, actions: acts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Create failed');
      setName('');
      setEnabled(true);
      setPriority(100);
      setCondition('{}');
      setActions('[]');
      await fetchRules();
    } catch (e: any) {
      setError(e.message || 'Failed to create');
    } finally {
      setLoading(false);
    }
  }

  async function toggle(id: string, value: boolean) {
    if (!token) return;
    setLoading(true);
    try {
      await fetch(`${rulesBase}/v1/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: value }),
      });
      await fetchRules();
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!token) return;
    if (!confirm('Delete rule?')) return;
    setLoading(true);
    try {
      await fetch(`${rulesBase}/v1/rules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetchRules();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Rules</h1>
        <button
          onClick={() => {
            localStorage.removeItem('token');
            router.replace('/login');
          }}
        >
          Logout
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: 12 }}>Error: {error}</div>
      )}

      <section style={{ marginBottom: 16 }}>
        <h3>Create Rule</h3>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            Priority
            <input type="number" value={priority} onChange={(e) => setPriority(parseInt(e.target.value || '0'))} />
          </label>
          <label>
            Enabled
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>
          <div />
          <label style={{ gridColumn: '1 / span 2' }}>
            Condition (JSON)
            <textarea value={condition} onChange={(e) => setCondition(e.target.value)} rows={4} style={{ width: '100%', fontFamily: 'monospace' }} />
          </label>
          <label style={{ gridColumn: '1 / span 2' }}>
            Actions (JSON)
            <textarea value={actions} onChange={(e) => setActions(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'monospace' }} />
          </label>
        </div>
        <button disabled={loading} onClick={() => createRule()} style={{ marginTop: 8 }}>Create</button>
      </section>

      <table border={1} cellPadding={8} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Enabled</th>
            <th>Priority</th>
            <th>Condition</th>
            <th>Actions</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.name}</td>
              <td>
                <input type="checkbox" checked={r.enabled} onChange={(e) => toggle(r.id, e.target.checked)} />
              </td>
              <td>{r.priority}</td>
              <td><pre style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{JSON.stringify(r.condition)}</pre></td>
              <td><pre style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{JSON.stringify(r.actions)}</pre></td>
              <td>{new Date(r.createdAt).toLocaleString()}</td>
              <td>
                <button onClick={() => remove(r.id)} disabled={loading}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

