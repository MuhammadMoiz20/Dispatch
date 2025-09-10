import React from 'react';

export function KPICard({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="card">
      <div className="card-header">{title}</div>
      <div className="card-body">
        <div className="text-2xl font-semibold">{value ?? '-'}</div>
      </div>
    </div>
  );
}

export type BarPoint = { t: string; v: number };

export function BarList({
  points,
  colorClass = 'bg-gray-400',
  format,
}: {
  points: BarPoint[];
  colorClass?: string;
  format?: (v: number) => string;
}) {
  if (!points?.length) return <div className="text-sm text-gray-500">No data</div>;
  const max = Math.max(1, ...points.map((p) => p.v));
  return (
    <div className="space-y-2">
      {points.map((p) => (
        <div key={p.t} className="flex items-center gap-3">
          <div className="w-24 text-xs text-gray-500">{p.t}</div>
          <div
            className={`h-2 rounded ${colorClass}`}
            style={{ width: `${(p.v / max) * 70 + 5}%` }}
          />
          <div className="text-sm">{format ? format(p.v) : p.v}</div>
        </div>
      ))}
    </div>
  );
}

export function BreakdownList({ items }: { items: Array<{ key: string; value: number }> }) {
  if (!items?.length) return <div className="text-sm text-gray-500">No data</div>;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((it) => (
        <li key={it.key} className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-300">{it.key || '(none)'}</span>
          <span className="font-medium">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function Section({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <div className="card-header">{title}</div>
      <div className="card-body">{children}</div>
    </section>
  );
}

export function fmtMs(ms?: number | null) {
  if (!ms && ms !== 0) return '-';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}
