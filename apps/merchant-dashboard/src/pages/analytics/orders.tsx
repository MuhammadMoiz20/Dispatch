import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { gqlAuth } from '../../lib/graphql';
import { DonutChart, TimeSeriesChart } from '../../components/charts';

type P = { t: string; v: number };
type Item = { key: string; value: number };
type OrdersOverview = { ordersByDay: P[]; channels: Item[] };

export default function OrdersAnalytics() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<OrdersOverview | null>(null);
  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    const to = new Date();
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    gqlAuth<{ analyticsOrders: OrdersOverview }>(
      `query Q($range: AnalyticsRange!) { analyticsOrders(range: $range) { ordersByDay { t v } channels { key value } } }`,
      t,
      { range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } },
    ).then((r) => setData(r.analyticsOrders));
  }, [router]);
  if (!token || !data) return null;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Orders Analytics</h1>
      </div>
      <section className="card">
        <div className="card-header">Orders by Day</div>
        <div className="card-body">
          <TimeSeriesChart points={data.ordersByDay} color="#8b5cf6" area />
        </div>
      </section>
      <section className="card">
        <div className="card-header">Channel Mix</div>
        <div className="card-body">
          <DonutChart items={data.channels} />
        </div>
      </section>
    </div>
  );
}
