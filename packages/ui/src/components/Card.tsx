import React from 'react';

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`uix-card ${className}`}>
      {(title || actions) && (
        <div className="uix-card-head">
          {title && <div className="uix-card-title">{title}</div>}
          <div className="uix-card-actions">{actions}</div>
        </div>
      )}
      <div className="uix-card-body">{children}</div>
    </section>
  );
}
