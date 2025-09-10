import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { gqlAuth } from '../../lib/graphql';
import { DonutChart, TimeSeriesChart } from '../../components/charts';

type Point = { t: string; v: number };
type Item = { key: string; value: number };
type KPI = {
  returnRatePct: number;
  returnsCount: number;
  refundsAmountCents: number;
  avgApprovalMs?: number | null;
  avgRefundMs?: number | null;
};
type Ret = { kpis: KPI; returnsByDay: Point[]; reasons: Item[]; channels: Item[] };

export default function ReturnsAnalytics() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Ret | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    const to = new Date();
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    gqlAuth<{ analyticsReturns: Ret }>(
      `query Ret($range: AnalyticsRange!) { analyticsReturns(range: $range) { kpis { returnRatePct returnsCount refundsAmountCents avgApprovalMs avgRefundMs } returnsByDay { t v } reasons { key value } channels { key value } } }`,
      t,
      { range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } },
    ).then((r) => setData(r.analyticsReturns));
  }, [router]);

  if (!token || !data) return null;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Returns Analytics</h1>
      </div>
      <section className="card">
        <div className="card-header">Returns by Day</div>
        <div className="card-body">
          <TimeSeriesChart points={data.returnsByDay} color="#4f46e5" area />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card">
          <div className="card-header">Top Reasons</div>
          <div className="card-body">
            <DonutChart items={data.reasons} />
          </div>
        </section>
        <section className="card">
          <div className="card-header">Channels</div>
          <div className="card-body">
            <DonutChart items={data.channels} />
          </div>
        </section>
      </div>
    </div>
  );
}

// table replaced by DonutChart for better visualization
