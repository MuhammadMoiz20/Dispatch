import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { gqlAuth } from '../../lib/graphql';
import { DonutChart, TimeSeriesChart, usdCents } from '../../components/charts';

type P = { t: string; v: number };
type Item = { key: string; value: number };
type RefundsOverview = { amountByDay: P[]; successRateByDay: P[]; providers: Item[] };

export default function RefundsAnalytics() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<RefundsOverview | null>(null);
  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    const to = new Date();
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    gqlAuth<{ analyticsRefunds: RefundsOverview }>(
      `query Q($range: AnalyticsRange!) { analyticsRefunds(range: $range) { amountByDay { t v } successRateByDay { t v } providers { key value } } }`,
      t,
      { range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } },
    ).then((r) => setData(r.analyticsRefunds));
  }, [router]);
  if (!token || !data) return null;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Refunds Analytics</h1>
      </div>
      <section className="card">
        <div className="card-header">Amount by Day</div>
        <div className="card-body">
          <TimeSeriesChart
            points={data.amountByDay}
            color="#06b6d4"
            area
            valueFormatter={usdCents}
          />
        </div>
      </section>
      <section className="card">
        <div className="card-header">Success Rate</div>
        <div className="card-body">
          <TimeSeriesChart
            points={data.successRateByDay}
            color="#22c55e"
            area
            percent
            yDomain={[0, 100]}
            valueFormatter={(n) => `${n.toFixed(0)}%`}
          />
        </div>
      </section>
      <section className="card">
        <div className="card-header">Providers</div>
        <div className="card-body">
          <DonutChart items={data.providers} />
        </div>
      </section>
    </div>
  );
}
