import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from 'recharts';

export type TimeSeriesPoint = { t: string; v: number };
export type BreakdownItem = { key: string; value: number };

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function formatDateLabel(d: string) {
  // Expecting YYYY-MM-DD; fallback to raw
  try {
    const parts = d.split('-').map((x) => parseInt(x, 10));
    if (parts.length === 3) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  } catch {
    /* ignore parse errors */
  }
  return d;
}

export function compactNumber(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }
}

export function usdCents(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(n / 100);
  } catch {
    return `$${(n / 100).toFixed(2)}`;
  }
}

function getDomainAndScale(values: number[]): {
  domain: [number, number];
  scale: 'linear' | 'log';
  plotValues?: number[];
  usedLog: boolean;
} {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return { domain: [0, 1], scale: 'linear', usedLog: false };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) {
    if (min === 0) return { domain: [0, 1], scale: 'linear', usedLog: false };
    const pad = Math.abs(min) * 0.1;
    return { domain: [min - pad, max + pad], scale: 'linear', usedLog: false };
  }
  const minPositive = Math.min(...finite.filter((v) => v > 0));
  const ratio = minPositive > 0 ? max / minPositive : Infinity;
  if (min >= 0 && ratio > 1000 && Number.isFinite(ratio) && minPositive !== Infinity) {
    // Use log scale; map zeros to a small floor to avoid breaking
    const floor = Math.max(minPositive * 0.5, 0.1);
    const plotValues = values.map((v) => (v <= 0 ? floor : v));
    const plotFinite = plotValues.filter((v) => Number.isFinite(v));
    const pmin = Math.min(...plotFinite);
    const pmax = Math.max(...plotFinite);
    return { domain: [pmin, pmax], scale: 'log', plotValues, usedLog: true };
  }
  // Linear with padding
  const pad = (max - min) * 0.1;
  return { domain: [min - pad, max + pad], scale: 'linear', usedLog: false };
}

type TimeSeriesChartProps = {
  points: TimeSeriesPoint[];
  color?: string; // hex
  area?: boolean;
  valueFormatter?: (n: number) => string;
  yDomain?: [number, number];
  percent?: boolean;
  height?: number;
  grid?: boolean;
};

export function TimeSeriesChart({
  points,
  color = '#4f46e5',
  area = true,
  valueFormatter = compactNumber,
  yDomain,
  percent = false,
  height = 240,
  grid = true,
}: TimeSeriesChartProps) {
  const mounted = useMounted();
  const data = useMemo(() => {
    const vals = points?.map((p) => (Number.isFinite(p.v) ? p.v : 0)) || [];
    const { domain, scale, plotValues, usedLog } = yDomain
      ? { domain: yDomain, scale: 'linear' as const, plotValues: undefined, usedLog: false }
      : getDomainAndScale(vals);
    return {
      usedLog,
      scale,
      domain,
      rows: (points || []).map((p, i) => ({
        time: p.t,
        value: vals[i] ?? 0,
        plot: plotValues ? plotValues[i] : (vals[i] ?? 0),
      })),
    };
  }, [points, yDomain]);

  if (!mounted) return <div className="text-sm text-gray-500">Loading chart…</div>;
  if (!points?.length) return <div className="text-sm text-gray-500">No data</div>;

  const stroke = color;
  const fill = color.replace('#', '').length === 6 ? `${color}33` : color; // light alpha

  const chart = area ? (
    <AreaChart data={data.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
      {grid && <CartesianGrid strokeDasharray="3 3" />}
      <XAxis dataKey="time" tickFormatter={formatDateLabel} minTickGap={24} />
      <YAxis
        allowDecimals
        tickFormatter={(v: number) => (percent ? `${v.toFixed(0)}%` : valueFormatter(v))}
        domain={data.domain as any}
        scale={data.scale}
      />
      <Tooltip
        formatter={(v: any) => (percent ? `${Number(v).toFixed(1)}%` : valueFormatter(Number(v)))}
        labelFormatter={(l: any) => formatDateLabel(String(l))}
      />
      <Area
        type="monotone"
        dataKey={data.scale === 'log' ? 'plot' : 'value'}
        stroke={stroke}
        fill={fill}
        strokeWidth={2}
      />
    </AreaChart>
  ) : (
    <LineChart data={data.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
      {grid && <CartesianGrid strokeDasharray="3 3" />}
      <XAxis dataKey="time" tickFormatter={formatDateLabel} minTickGap={24} />
      <YAxis
        allowDecimals
        tickFormatter={(v: number) => (percent ? `${v.toFixed(0)}%` : valueFormatter(v))}
        domain={data.domain as any}
        scale={data.scale}
      />
      <Tooltip
        formatter={(v: any) => (percent ? `${Number(v).toFixed(1)}%` : valueFormatter(Number(v)))}
        labelFormatter={(l: any) => formatDateLabel(String(l))}
      />
      <Line
        type="monotone"
        dataKey={data.scale === 'log' ? 'plot' : 'value'}
        stroke={stroke}
        dot={false}
        strokeWidth={2}
      />
    </LineChart>
  );

  return (
    <div className="relative">
      {data.usedLog && (
        <div className="absolute right-2 top-2 text-[10px] uppercase bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
          Log Scale
        </div>
      )}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>{chart}</ResponsiveContainer>
      </div>
    </div>
  );
}

type DonutChartProps = {
  items: BreakdownItem[];
  colors?: string[];
  height?: number;
  valueFormatter?: (n: number) => string;
  maxSlices?: number; // Aggregate rest as Other
};

const DEFAULT_COLORS = [
  '#4f46e5',
  '#06b6d4',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#e11d48',
];

export function DonutChart({
  items,
  colors = DEFAULT_COLORS,
  height = 240,
  valueFormatter = compactNumber,
  maxSlices = 6,
}: DonutChartProps) {
  const mounted = useMounted();
  const data = useMemo(() => {
    const list = (items || []).filter((x) => Number.isFinite(x.value));
    if (list.length > maxSlices) {
      const sorted = [...list].sort((a, b) => b.value - a.value);
      const head = sorted.slice(0, maxSlices - 1);
      const tail = sorted.slice(maxSlices - 1);
      const other = { key: 'Other', value: tail.reduce((s, x) => s + x.value, 0) };
      return [...head, other];
    }
    return list;
  }, [items, maxSlices]);
  if (!mounted) return <div className="text-sm text-gray-500">Loading chart…</div>;
  if (!data?.length) return <div className="text-sm text-gray-500">No data</div>;
  const total = data.reduce((s, x) => s + (x.value || 0), 0) || 1;
  return (
    <div className="flex items-center gap-4" style={{ width: '100%', height }}>
      <ResponsiveContainer width="60%" height="100%">
        <PieChart>
          <Tooltip formatter={(v: any) => valueFormatter(Number(v))} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            minAngle={2}
          >
            {data.map((_, idx) => (
              <Cell key={`c-${idx}`} fill={colors[idx % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1">
        <ul className="space-y-1 text-sm">
          {data.map((it, idx) => {
            const pct = ((it.value / total) * 100).toFixed(1);
            return (
              <li className="flex items-center justify-between" key={it.key + idx}>
                <span className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: colors[idx % colors.length] }}
                  />
                  {it.key || '(none)'}
                </span>
                <span className="font-medium tabular-nums">
                  {valueFormatter(it.value)} · {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
