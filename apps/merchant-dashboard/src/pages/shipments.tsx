import { useEffect, useMemo, useState } from 'react';
import { VirtualTable, Chip, Stepper } from '@dispatch/ui';

type Shipment = {
  id: string;
  status: string;
  channel: string;
  externalId: string;
  createdAt: string;
};

const PIPELINE = [
  'created',
  'labelled',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
] as const;
type PipelineStatus = (typeof PIPELINE)[number];

export default function Shipments() {
  const apiUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql',
    [],
  );
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PipelineStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setToken(t);
  }, []);

  async function fetchShipments(opts?: { page?: number }) {
    if (!token) return;
    const p = opts?.page ?? page;
    setLoading(true);
    setError(null);
    try {
      // Use orders as proxy for shipments (status/channel map)
      const query = `query Orders($page: Int, $pageSize: Int, $status: String) {
        orders(page: $page, pageSize: $pageSize, status: $status) {
          items { id status channel externalId createdAt }
          page pageSize total
        }
      }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query,
          variables: { page: p, pageSize, status: status || undefined },
        }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      const data = json.data.orders;
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) void fetchShipments({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shipments</h1>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-center gap-2">
            {PIPELINE.map((s) => (
              <button
                key={s}
                className={`btn-secondary ${status === s ? 'ring-2 ring-offset-2 ring-brand-600' : ''}`}
                onClick={() => setStatus((prev) => (prev === s ? '' : s))}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
            <button className="btn-secondary" onClick={() => setStatus('')}>
              All
            </button>
          </div>
        </div>
      </div>

      <VirtualTable
        ariaLabel="Shipments table"
        rows={items}
        columns={[
          {
            key: 'id',
            header: 'ID',
            width: 220,
            render: (r) => <code className="text-xs">{r.id}</code>,
          },
          {
            key: 'status',
            header: 'Status',
            width: 160,
            render: (r) => (
              <Chip
                tone={
                  r.status === 'delivered'
                    ? 'success'
                    : r.status === 'failed'
                      ? 'danger'
                      : 'neutral'
                }
              >
                {r.status}
              </Chip>
            ),
          },
          { key: 'channel', header: 'Carrier', width: 160 },
          { key: 'externalId', header: 'External ID', width: 180 },
          {
            key: 'createdAt',
            header: 'Created',
            width: 220,
            render: (r) => new Date(r.createdAt).toLocaleString(),
          },
        ]}
        height={520}
      />

      <div className="flex items-center gap-3">
        <button
          disabled={page <= 1 || loading}
          onClick={() => fetchShipments({ page: page - 1 })}
          className="btn-secondary"
        >
          Prev
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Page {page} / {totalPages} ({total} total)
        </span>
        <button
          disabled={page >= totalPages || loading}
          onClick={() => fetchShipments({ page: page + 1 })}
          className="btn-secondary"
        >
          Next
        </button>
      </div>

      <div className="card">
        <div className="card-header">Status Pipeline</div>
        <div className="card-body">
          <Stepper
            steps={[
              {
                key: 'created',
                label: 'Created',
                status: status === 'created' ? 'active' : 'pending',
              },
              {
                key: 'labelled',
                label: 'Labelled',
                status: status === 'labelled' ? 'active' : 'pending',
              },
              {
                key: 'in_transit',
                label: 'In‑Transit',
                status: status === 'in_transit' ? 'active' : 'pending',
              },
              {
                key: 'out_for_delivery',
                label: 'Out for Delivery',
                status: status === 'out_for_delivery' ? 'active' : 'pending',
              },
              {
                key: 'delivered',
                label: 'Delivered',
                status: status === 'delivered' ? 'active' : 'pending',
              },
              {
                key: 'failed',
                label: 'Failed',
                status: status === 'failed' ? 'active' : 'pending',
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
