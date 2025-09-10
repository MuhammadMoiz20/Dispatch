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

  const rulesBase = useMemo(
    () => process.env.NEXT_PUBLIC_RULES_BASE || 'http://localhost:14004',
    [],
  );

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
      const res = await fetch(`${rulesBase}/v1/rules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
  const [condition, setCondition] = useState(
    '{"all":[{"==":[{"var":"return.reason"},"wrong size"]}] }',
  );
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
      await fetch(`${rulesBase}/v1/rules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchRules();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Rules</h1>
      </div>

      {error && (
        <div className="card">
          <div className="card-body text-red-600">Error: {error}</div>
        </div>
      )}

      <section className="card">
        <div className="card-header">Create Rule</div>
        <div className="card-body grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">Priority</span>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value || '0'))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            />
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="text-gray-600 dark:text-gray-300">Enabled</span>
          </label>
          <div />
          <label className="text-sm sm:col-span-2">
            <span className="text-gray-600 dark:text-gray-300">Condition (JSON)</span>
            <textarea
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 font-mono"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-gray-600 dark:text-gray-300">Actions (JSON)</span>
            <textarea
              value={actions}
              onChange={(e) => setActions(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 font-mono"
            />
          </label>
          <div className="sm:col-span-2">
            <button disabled={loading} onClick={() => createRule()} className="btn-primary">
              Create
            </button>
          </div>
        </div>
      </section>

      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300">
                <th className="py-2">ID</th>
                <th className="py-2">Name</th>
                <th className="py-2">Enabled</th>
                <th className="py-2">Priority</th>
                <th className="py-2">Condition</th>
                <th className="py-2">Actions</th>
                <th className="py-2">Created</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-2 font-mono text-xs">{r.id}</td>
                  <td className="py-2">{r.name}</td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => toggle(r.id, e.target.checked)}
                    />
                  </td>
                  <td className="py-2">{r.priority}</td>
                  <td className="py-2">
                    <pre className="max-w-xs whitespace-pre-wrap">
                      {JSON.stringify(r.condition)}
                    </pre>
                  </td>
                  <td className="py-2">
                    <pre className="max-w-xs whitespace-pre-wrap">{JSON.stringify(r.actions)}</pre>
                  </td>
                  <td className="py-2">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <button
                      onClick={() => remove(r.id)}
                      disabled={loading}
                      className="btn-secondary"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
