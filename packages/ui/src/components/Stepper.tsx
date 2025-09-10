import React from 'react';

export type Step = { key: string; label: string; status: 'complete' | 'active' | 'pending' };

export function Stepper({ steps, ariaLabel }: { steps: Step[]; ariaLabel?: string }) {
  return (
    <div className="uix-stepper" aria-label={ariaLabel || 'Progress'}>
      {steps.map((s) => (
        <div
          key={s.key}
          className={`uix-step ${s.status}`}
          aria-current={s.status === 'active' ? 'step' : undefined}
        >
          <span className="uix-dot" aria-hidden="true" />
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
