import Link from 'next/link';
import { useEffect, useState } from 'react';
import { gqlAuth } from '../lib/graphql';
import { BreakdownList, KPICard, fmtMs } from '../components/ui';
import { DonutChart, TimeSeriesChart } from '../components/charts';

type TimeSeriesPoint = { t: string; v: number };
type BreakdownItem = { key: string; value: number };
type KPISet = {
  returnRatePct: number;
  returnsCount: number;
  refundsAmountCents: number;
  avgApprovalMs?: number | null;
  avgRefundMs?: number | null;
};
type ReturnsOverview = {
  kpis: KPISet;
  returnsByDay: TimeSeriesPoint[];
  reasons: BreakdownItem[];
  channels: BreakdownItem[];
};
type OrdersOverview = { ordersByDay: TimeSeriesPoint[] };

export default function Home() {
  const [data, setData] = useState<ReturnsOverview | null>(null);
  const [orders, setOrders] = useState<OrdersOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!t) return;
    const to = new Date();
    const from = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    gqlAuth<{ analyticsReturns: ReturnsOverview }>(
      `query Ret($range: AnalyticsRange!) { analyticsReturns(range: $range) { kpis { returnRatePct returnsCount refundsAmountCents avgApprovalMs avgRefundMs } returnsByDay { t v } reasons { key value } channels { key value } } }`,
      t,
      { range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } },
    )
      .then((r) => setData(r.analyticsReturns))
      .catch((e) => setError(e?.message || 'Failed to load analytics'));

    gqlAuth<{ analyticsOrders: OrdersOverview }>(
      `query Q($range: AnalyticsRange!) { analyticsOrders(range: $range) { ordersByDay { t v } } }`,
      t,
      { range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } },
    )
      .then((r) => setOrders(r.analyticsOrders))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link className="btn-secondary" href="/orders">
            View Orders
          </Link>
          <Link className="btn-primary" href="/returns">
            Initiate Return
          </Link>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="card-body">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KPICard
          title="Orders (14d)"
          value={(() => {
            if (orders) {
              const total = orders.ordersByDay.reduce(
                (s, p) => s + (Number.isFinite(p.v) ? p.v : 0),
                0,
              );
              return String(total);
            }
            // Fallback: estimate from returns + return rate when orders analytics is unavailable
            if (data && Number.isFinite(data.kpis.returnRatePct) && data.kpis.returnRatePct > 0) {
              const est = Math.round(data.kpis.returnsCount / (data.kpis.returnRatePct / 100));
              if (Number.isFinite(est)) return `~${est}`;
            }
            return undefined;
          })()}
        />
        <KPICard
          title="Return Rate"
          value={data ? `${data.kpis.returnRatePct.toFixed(1)}%` : undefined}
        />
        <KPICard title="Returns" value={data ? `${data.kpis.returnsCount}` : undefined} />
        <KPICard
          title="Refunds"
          value={data ? `$${(data.kpis.refundsAmountCents / 100).toFixed(2)}` : undefined}
        />
        <KPICard title="Avg Approval" value={data ? fmtMs(data.kpis.avgApprovalMs) : undefined} />
        <KPICard title="Avg Refund" value={data ? fmtMs(data.kpis.avgRefundMs) : undefined} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="card-header">Returns (last 14d)</div>
          <div className="card-body">
            <TimeSeriesChart points={data?.returnsByDay || []} color="#4f46e5" area />
          </div>
        </div>
        <div className="card">
          <div className="card-header">Orders (last 14d)</div>
          <div className="card-body">
            <TimeSeriesChart points={orders?.ordersByDay || []} color="#8b5cf6" area />
          </div>
        </div>
        <div className="card">
          <div className="card-header">Quick Links</div>
          <div className="card-body grid grid-cols-2 gap-2">
            <Link className="btn-secondary" href="/analytics">
              Analytics
            </Link>
            <Link className="btn-secondary" href="/webhooks">
              Webhooks
            </Link>
            <Link className="btn-secondary" href="/users">
              Users
            </Link>
            <Link className="btn-secondary" href="/rules">
              Rules
            </Link>
            <Link className="btn-secondary" href="/integrations">
              Integrations
            </Link>
            <Link className="btn-secondary" href="/settings">
              Settings
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">Top Reasons</div>
          <div className="card-body">
            {data ? <DonutChart items={data.reasons} /> : <BreakdownList items={[]} />}
          </div>
        </div>
        <div className="card">
          <div className="card-header">Channels</div>
          <div className="card-body">
            {data ? <DonutChart items={data.channels} /> : <BreakdownList items={[]} />}
          </div>
        </div>
      </section>
    </div>
  );
}

// fmtMs imported from components/ui
