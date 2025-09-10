import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { makeWsClient, subscribe } from '../../lib/subscriptions';

type Return = { id: string; orderId: string; state: string; reason: string; createdAt: string };
type Label = {
  id: string;
  returnId: string;
  carrier: string;
  service: string;
  downloadUrl: string;
  costCents: number;
  currency: string;
  createdAt: string;
};

export default function ReturnStatus() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const apiUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql',
    [],
  );
  const ordersBase = useMemo(
    () => process.env.NEXT_PUBLIC_ORDERS_URL || 'http://localhost:14002',
    [],
  );
  const [data, setData] = useState<Return | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<Label | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // Try GraphQL first
        const query = `query ReturnById($id: ID!) { returnById(id: $id) { id orderId state reason createdAt } }`;
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { id } }),
        });
        const json = await res.json();
        if (!json.errors?.length && json.data?.returnById) {
          setData(json.data.returnById);
          return;
        }
        // Fallback to Orders REST
        const rest = await fetch(`${ordersBase}/v1/returns/${id}`);
        if (!rest.ok) throw new Error('Failed to load');
        const rjson = await rest.json();
        setData({ ...rjson, createdAt: new Date(rjson.createdAt).toISOString() });
      } catch (e: any) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, apiUrl]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // Try GraphQL first
        const query = `query LabelByReturn($id: ID!) { labelByReturn(returnId: $id) { id returnId carrier service costCents currency downloadUrl createdAt } }`;
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { id } }),
        });
        const json = await res.json();
        if (!json.errors?.length && json.data?.labelByReturn) {
          setLabel(json.data.labelByReturn);
          return;
        }
        // Fallback to Orders REST
        const rest = await fetch(`${ordersBase}/v1/returns/${id}/label`);
        if (rest.ok) {
          const l = await rest.json();
          setLabel({ ...l, createdAt: new Date(l.createdAt).toISOString() });
        }
      } catch (e) {
        // ignore label load failures; UI will show missing label
      }
    })();
  }, [id, apiUrl]);

  useEffect(() => {
    if (!id) return;
    // Live updates: return state changes (public subscription)
    const client = makeWsClient();
    const q = `subscription ($id: ID!) { returnUpdated(returnId: $id) { returnId state at } }`;
    const dispose = subscribe(client, q, { id }, (d: any) => {
      const evt = d?.returnUpdated as { returnId: string; state: string } | undefined;
      if (!evt) return;
      setData((prev) => (prev ? { ...prev, state: evt.state } : prev));
      if (evt.state === 'label_generated') {
        // attempt to load label when state indicates available
        (async () => {
          try {
            const query = `query LabelByReturn($id: ID!) { labelByReturn(returnId: $id) { id returnId carrier service costCents currency downloadUrl createdAt } }`;
            const res = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, variables: { id } }),
            });
            const json = await res.json();
            if (!json.errors?.length && json.data?.labelByReturn) setLabel(json.data.labelByReturn);
          } catch (e) {
            // ignore transient errors; subscription may deliver more updates
          }
        })();
      }
    });
    return () => {
      try {
        dispose();
      } catch (e) {
        // ignore
      }
    };
  }, [id, apiUrl]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Return Status</h1>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {data && (
        <div>
          <p>
            <strong>Return ID:</strong> {data.id}
          </p>
          <p>
            <strong>Order ID:</strong> {data.orderId}
          </p>
          <p>
            <strong>State:</strong> {data.state}
          </p>
          <p>
            <strong>Reason:</strong> {data.reason}
          </p>
          <p>
            <strong>Created:</strong> {new Date(data.createdAt).toLocaleString()}
          </p>
          {label ? (
            <p>
              <strong>Label:</strong>{' '}
              <a href={label.downloadUrl} target="_blank" rel="noreferrer">
                Download
              </a>{' '}
              ({label.carrier} {label.service})
            </p>
          ) : (
            <p>
              <em>No label available yet.</em>
            </p>
          )}
        </div>
      )}
    </main>
  );
}
