import { useEffect, useMemo, useRef, useState } from 'react';

type Return = { id: string; state: string };

function enqueueOffline(id: string) {
  try {
    const key = 'scanQueue';
    const cur = JSON.parse(localStorage.getItem(key) || '[]') as string[];
    cur.push(id);
    localStorage.setItem(key, JSON.stringify(cur));
  } catch (e) {
    // ignore storage failures
  }
}

async function drainOffline(apiUrl: string, token: string) {
  const key = 'scanQueue';
  try {
    const cur = JSON.parse(localStorage.getItem(key) || '[]') as string[];
    const next: string[] = [];
    for (const id of cur) {
      try {
        const mutation = `mutation Scan($id: ID!) { scanReturn(id: $id) { id state } }`;
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query: mutation, variables: { id } }),
        });
        if (!res.ok) throw new Error('Failed');
      } catch (e) {
        next.push(id);
      }
    }
    localStorage.setItem(key, JSON.stringify(next));
  } catch (e) {
    // ignore storage failures
  }
}

export default function Scan() {
  const apiUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql',
    [],
  );
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [last, setLast] = useState<Return | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [usingCamera, setUsingCamera] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) window.location.href = '/';
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    const onOnline = () => {
      void drainOffline(apiUrl, token);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [token, apiUrl]);

  async function scan(id: string) {
    setError(null);
    if (!token) return;
    try {
      if (!navigator.onLine) {
        enqueueOffline(id);
        setLast({ id, state: 'queued_offline' });
        return;
      }
      const mutation = `mutation Scan($id: ID!) { scanReturn(id: $id) { id state } }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: mutation, variables: { id } }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Failed');
      setLast(json.data.scanReturn as Return);
    } catch (e: any) {
      setError(e.message || 'Failed');
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setUsingCamera(true);
      // Use BarcodeDetector if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BD: any = (window as any).BarcodeDetector;
      if (!BD) return; // fallback to manual input
      const detector = new BD({ formats: ['qr_code', 'code_128', 'ean_13'] });
      const tick = async () => {
        if (!videoRef.current) return;
        try {
          const bitmaps = [await createImageBitmap(videoRef.current)] as any;
          for (const b of bitmaps) {
            const codes = await detector.detect(b);
            if (codes && codes.length > 0) {
              const txt = codes[0].rawValue || codes[0].raw || '';
              if (txt) {
                await scan(txt.trim());
              }
            }
          }
        } catch (e) {
          // ignore frame decode errors
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (e) {
      setError('Camera not available');
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Scanner</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ marginBottom: 12 }}>
        <button onClick={startCamera} disabled={usingCamera}>
          Use Camera
        </button>
      </div>
      <div>
        <video ref={videoRef} style={{ width: 320, height: 240, background: '#000' }} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label>
          Manual Return ID:
          <input
            style={{ marginLeft: 8 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button
          style={{ marginLeft: 8 }}
          onClick={() => {
            if (input) {
              void scan(input);
              setInput('');
            }
          }}
        >
          Scan
        </button>
      </div>
      {last && (
        <div style={{ marginTop: 16 }}>
          <p>
            <strong>Last:</strong> {last.id} → {last.state}
          </p>
        </div>
      )}
    </main>
  );
}
