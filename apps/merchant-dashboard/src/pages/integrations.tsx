import { useEffect, useState } from 'react';

type Connection = { id: string; shop: string; status: string; lastWebhookAt?: string };

export default function IntegrationsPage() {
  const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_URL || 'http://localhost:14005';
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const [shop, setShop] = useState('test-shop.myshopify.com');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchConnections() {
    try {
      const res = await fetch(`${shopifyUrl}/v1/shopify/connections`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      const json = await res.json();
      setConnections(json?.items || []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopifyUrl, token]);

  async function startInstall() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${shopifyUrl}/v1/shopify/install/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ shop }),
      });
      const json = await res.json();
      if (json?.redirectUrl) {
        const full = `${shopifyUrl}${json.redirectUrl}`;
        window.location.href = full;
      } else if (json?.error) {
        setError(json.error);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to start install');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Integrations</h1>
      {error && (
        <div className="card">
          <div className="card-body text-red-600">{error}</div>
        </div>
      )}
      <section className="card">
        <div className="card-header">Connect Shopify</div>
        <div className="card-body space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Enter your shop domain to connect via OAuth (dev stub).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm">
              <span className="text-gray-600 dark:text-gray-300">Shop domain</span>
              <input
                className="mt-1 ml-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                placeholder="your-shop.myshopify.com"
              />
            </label>
            <button onClick={startInstall} disabled={loading} className="btn-primary">
              Connect
            </button>
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-header">Connected Stores</div>
        <div className="card-body">
          {connections.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">No stores connected</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {connections.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <span className="font-medium">{c.shop}</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    — {c.status}{' '}
                    {c.lastWebhookAt
                      ? `(last webhook: ${new Date(c.lastWebhookAt).toLocaleString()})`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
