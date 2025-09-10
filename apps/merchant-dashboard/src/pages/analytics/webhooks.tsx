import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { gqlAuth } from '../../lib/graphql';
import { DonutChart, TimeSeriesChart } from '../../components/charts';

type P = { t: string; v: number };
type Item = { key: string; value: number };
type WebhooksOverview = { successRateByDay: P[]; deliveriesByStatus: Item[] };

export default function WebhooksAnalytics() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<WebhooksOverview | null>(null);
  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    const to = new Date();
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    gqlAuth<{ analyticsWebhooks: WebhooksOverview }>(
      `query Q($range: AnalyticsRange!) { analyticsWebhooks(range: $range) { successRateByDay { t v } deliveriesByStatus { key value } } }`,
      t,
      { range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } },
    ).then((r) => setData(r.analyticsWebhooks));
  }, [router]);
  if (!token || !data) return null;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Webhooks Analytics</h1>
      </div>
      <section className="card">
        <div className="card-header">Success Rate by Day</div>
        <div className="card-body">
          <TimeSeriesChart
            points={data.successRateByDay}
            color="#f59e0b"
            area
            percent
            yDomain={[0, 100]}
            valueFormatter={(n) => `${n.toFixed(0)}%`}
          />
        </div>
      </section>
      <section className="card">
        <div className="card-header">Deliveries by Status</div>
        <div className="card-body">
          <DonutChart items={data.deliveriesByStatus} />
        </div>
      </section>
    </div>
  );
}
