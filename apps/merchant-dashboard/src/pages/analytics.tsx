import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { gqlAuth } from '../lib/graphql';
import { KPICard, fmtMs } from '../components/ui';
import { TimeSeriesChart, DonutChart } from '../components/charts';

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
type OrdersOverview = { ordersByDay: TimeSeriesPoint[]; channels: BreakdownItem[] };

export default function AnalyticsOverview() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<ReturnsOverview | null>(null);
  const [orders, setOrders] = useState<OrdersOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    const to = new Date();
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    gqlAuth<{ analyticsReturns: ReturnsOverview }>(
      `query Ret($range: AnalyticsRange!) { analyticsReturns(range: $range) { kpis { returnRatePct returnsCount refundsAmountCents avgApprovalMs avgRefundMs } returnsByDay { t v } reasons { key value } channels { key value } } }`,
      t,
      { range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } },
    )
      .then((r) => setData(r.analyticsReturns))
      .catch((e) => setError(e?.message || 'Failed to load analytics'));

    gqlAuth<{ analyticsOrders: OrdersOverview }>(
      `query Q($range: AnalyticsRange!) { analyticsOrders(range: $range) { ordersByDay { t v } channels { key value } } }`,
      t,
      { range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } },
    )
      .then((r) => setOrders(r.analyticsOrders))
      .catch(() => {});
  }, [router]);

  if (!token) return null;
  if (error)
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <div className="card">
          <div className="card-body text-red-600">{error}</div>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <div className="card">
          <div className="card-body">Loading…</div>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Analytics Overview</h1>
      </div>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KPICard title="Return Rate" value={`${data.kpis.returnRatePct.toFixed(1)}%`} />
        <KPICard title="Returns" value={`${data.kpis.returnsCount}`} />
        <KPICard title="Refunds" value={`$${(data.kpis.refundsAmountCents / 100).toFixed(2)}`} />
        <KPICard title="Avg Approval" value={fmtMs(data.kpis.avgApprovalMs)} />
        <KPICard title="Avg Refund" value={fmtMs(data.kpis.avgRefundMs)} />
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">Returns (last 30d)</div>
          <div className="card-body">
            <TimeSeriesChart points={data.returnsByDay} color="#4f46e5" area />
          </div>
        </div>
        <div className="card">
          <div className="card-header">Orders (last 30d)</div>
          <div className="card-body">
            <TimeSeriesChart points={orders?.ordersByDay || []} color="#8b5cf6" area />
          </div>
        </div>
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">Top Reasons</div>
          <div className="card-body">
            <DonutChart items={data.reasons} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">Order Channels</div>
          <div className="card-body">
            <DonutChart items={orders?.channels || []} />
          </div>
        </div>
      </section>
    </div>
  );
}
