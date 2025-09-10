import React from 'react';

export function Tooltip({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <span className="uix-tooltip" data-tip={tip} role="tooltip">
      {children}
    </span>
  );
}
