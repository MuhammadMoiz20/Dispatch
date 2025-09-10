import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { gqlAuth } from '../../lib/graphql';
import { DonutChart, TimeSeriesChart, usdCents } from '../../components/charts';

type P = { t: string; v: number };
type Item = { key: string; value: number };
type LabelsOverview = { costByDay: P[]; carrierMix: Item[] };

export default function LabelsAnalytics() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<LabelsOverview | null>(null);
  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    const to = new Date();
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    gqlAuth<{ analyticsLabels: LabelsOverview }>(
      `query Q($range: AnalyticsRange!) { analyticsLabels(range: $range) { costByDay { t v } carrierMix { key value } } }`,
      t,
      { range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } },
    ).then((r) => setData(r.analyticsLabels));
  }, [router]);
  if (!token || !data) return null;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shipping Labels Analytics</h1>
      </div>
      <section className="card">
        <div className="card-header">Cost by Day</div>
        <div className="card-body">
          <TimeSeriesChart points={data.costByDay} color="#22c55e" area valueFormatter={usdCents} />
        </div>
      </section>
      <section className="card">
        <div className="card-header">Carrier/Service Mix</div>
        <div className="card-body">
          <DonutChart items={data.carrierMix} />
        </div>
      </section>
    </div>
  );
}
