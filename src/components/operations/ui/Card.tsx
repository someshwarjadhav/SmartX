import type * as React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../../lib/portal/cn';

export const Card: React.FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => {
  return <div {...rest} className={cn('min-w-0 rounded-2xl border border-line bg-panel shadow-card', className)} />;
};

/** Gradient header band, same as the SmartX filter card. */
export const CardHeader: React.FC<{ title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }> = ({ title, subtitle, action, className }) => {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-t-2xl border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5', className)}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-brand to-glow" aria-hidden />
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold leading-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-mute sm:text-sm">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
};
