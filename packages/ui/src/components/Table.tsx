import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export type Column<T> = {
  key: keyof T | string;
  header: string;
  width?: number | string;
  render?: (row: T) => React.ReactNode;
};

export function VirtualTable<T extends { id: string | number }>({
  rows,
  columns,
  height = 480,
  rowHeight = 44,
  ariaLabel,
}: {
  rows: T[];
  columns: Column<T>[];
  height?: number;
  rowHeight?: number;
  ariaLabel?: string;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const totalHeight = rowVirtualizer.getTotalSize();
  const virtualItems = rowVirtualizer.getVirtualItems();

  const colStyles = useMemo(() => columns.map((c) => ({ width: c.width ?? undefined })), [columns]);

  return (
    <div className="uix-table uix-card" role="region" aria-label={ariaLabel || 'Data table'}>
      <div className="uix-table-head" role="rowgroup">
        <div className="uix-table-row" role="row">
          {columns.map((c, i) => (
            <div key={String(c.key)} className="uix-th" role="columnheader" style={colStyles[i]}>
              {c.header}
            </div>
          ))}
        </div>
      </div>
      <div ref={parentRef} className="uix-table-body" role="rowgroup" style={{ height }}>
        <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
          {virtualItems.map((vi) => {
            const row = rows[vi.index];
            return (
              <div
                key={row.id}
                className="uix-tr"
                role="row"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                {columns.map((c, i) => (
                  <div key={String(c.key)} className="uix-td" role="cell" style={colStyles[i]}>
                    {c.render ? c.render(row) : (row as any)[c.key]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
