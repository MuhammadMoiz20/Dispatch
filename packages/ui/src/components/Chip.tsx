import React from 'react';

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger';

export function Chip({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: ChipTone;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`uix-chip ${tone} ${className}`.trim()}>{children}</span>;
}
