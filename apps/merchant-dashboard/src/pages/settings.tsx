import { useContext, useEffect, useState } from 'react';
import { gqlAuth } from '../lib/graphql';
import { ThemeContext, TenantTheme } from '@dispatch/ui';

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
  key?: string;
};

export default function Settings() {
  const { theme, setTheme, tenantId } = useContext(ThemeContext);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const apiUrl =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql'
      : '';
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('Default');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  async function refresh() {
    if (!token) return;
    const query = `query { apiKeys { items { id name keyPrefix createdAt lastUsedAt } } }`;
    const data = await gqlAuth<{ apiKeys: { items: ApiKey[] } }>(query, token);
    setKeys(data.apiKeys.items);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const mutation = `mutation($name: String!) { createApiKey(name: $name) { id name keyPrefix key } }`;
    const data = await gqlAuth<{ createApiKey: ApiKey }>(mutation, token, { name: newKeyName });
    setCreatedKey(data.createApiKey.key || null);
    await refresh();
  }

  async function revoke(id: string) {
    if (!token) return;
    const mutation = `mutation($id: String!) { revokeApiKey(id: $id) }`;
    await gqlAuth(mutation, token, { id });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <section className="card">
        <div className="card-header">Branding (Tenant Theme)</div>
        <div className="card-body flex flex-wrap items-center gap-3">
          <label className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">Theme</span>
            <select
              value={theme}
              onChange={async (e) => {
                const next = e.target.value as TenantTheme;
                setTheme(next);
                if (!token) return;
                try {
                  const mutation = `mutation SetTenantTheme($theme: String!) { setTenantTheme(theme: $theme) }`;
                  await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ query: mutation, variables: { theme: next } }),
                  });
                } catch (e) {
                  // non-fatal: local theme remains applied
                }
              }}
              className="ml-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1"
            >
              <option value="default">Default</option>
              <option value="acme">Acme</option>
              <option value="nova">Nova</option>
              <option value="orchid">Orchid</option>
            </select>
          </label>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Applies for tenant: <code>{tenantId || 'unknown'}</code>
          </p>
        </div>
      </section>
      <section className="card">
        <div className="card-header">API Keys</div>
        <div className="card-body space-y-3">
          <form onSubmit={createKey} className="flex flex-wrap items-center gap-2">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Name"
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            />
            <button type="submit" className="btn-primary">
              Create
            </button>
          </form>
          {createdKey && (
            <p className="text-sm text-green-700">
              Copy your key now (shown once):{' '}
              <code className="px-1 py-0.5 rounded bg-green-50 dark:bg-green-900/30">
                {createdKey}
              </code>
            </p>
          )}
          <ul className="space-y-2">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap gap-3 items-center">
                <span className="font-medium">{k.name}</span>
                <code className="text-xs">{k.keyPrefix}••••</code>
                <button onClick={() => revoke(k.id)} className="btn-secondary">
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
