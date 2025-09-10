import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';

type CartItem = { sku: string; quantity: number };

export default function Checkout() {
  const router = useRouter();
  const [channel, setChannel] = useState('test-store');
  const [extId, setExtId] = useState('');
  const [delayMs, setDelayMs] = useState<number>(0);
  const [failRate, setFailRate] = useState<number>(0);
  const [duplicate, setDuplicate] = useState<boolean>(false);
  const [bulkCount, setBulkCount] = useState<number>(1);
  const [log, setLog] = useState<string>('');
  const cart: CartItem[] = useMemo(() => {
    try {
      const raw = (router.query.cart as string) || '[]';
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      return [];
    }
  }, [router.query.cart]);

  const submit = async () => {
    const body = {
      channel,
      externalId: extId || undefined,
      items: cart,
      options: { delayMs, failRate, duplicate },
    };
    setLog('Submitting...');
    try {
      if (bulkCount > 1) {
        const resp = await fetch('/api/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: bulkCount, base: body }),
        });
        const data = await resp.json();
        setLog(JSON.stringify(data, null, 2));
      } else {
        const resp = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        setLog(JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      setLog('Error: ' + (e?.message || 'unknown'));
    }
  };

  return (
    <div className="container">
      <h1>Checkout</h1>
      <div className="card">
        <h3>Items</h3>
        {cart.length === 0 ? (
          <div>No items</div>
        ) : (
          <ul>
            {cart.map((i) => (
              <li key={i.sku}>
                {i.sku} — qty {i.quantity}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Options</h3>
        <div className="row">
          <label style={{ width: 140 }}>Channel</label>
          <input
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="test-store"
          />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label style={{ width: 140 }}>External ID</label>
          <input value={extId} onChange={(e) => setExtId(e.target.value)} placeholder="auto" />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label style={{ width: 140 }}>Delay (ms)</label>
          <input
            type="number"
            value={delayMs}
            onChange={(e) => setDelayMs(parseInt(e.target.value || '0', 10))}
          />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label style={{ width: 140 }}>Fail rate (0-1)</label>
          <input
            type="number"
            step="0.1"
            min={0}
            max={1}
            value={failRate}
            onChange={(e) =>
              setFailRate(Math.max(0, Math.min(1, parseFloat(e.target.value || '0'))))
            }
          />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label style={{ width: 140 }}>Duplicate send</label>
          <input
            type="checkbox"
            checked={duplicate}
            onChange={(e) => setDuplicate(e.target.checked)}
          />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label style={{ width: 140 }}>Bulk count</label>
          <input
            type="number"
            min={1}
            value={bulkCount}
            onChange={(e) => setBulkCount(parseInt(e.target.value || '1', 10))}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={submit}>Place order</button>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Result</h3>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{log}</pre>
      </div>
    </div>
  );
}
