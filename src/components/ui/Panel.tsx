import type * as React from 'react';
import { cn } from '../../lib/cn';

interface Props {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const Panel: React.FC<Props> = ({ title, subtitle, action, className, bodyClassName, children }) => (
  <section className={cn('flex min-w-0 flex-col rounded-2xl border border-line bg-panel shadow-card', className)}>
    {(title || action) && (
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          {title && <h2 className="font-display text-base font-semibold leading-tight">{title}</h2>}
          {subtitle && <p className="mt-1 text-xs text-mute sm:text-sm">{subtitle}</p>}
        </div>
        {action}
      </header>
    )}
    <div className={cn('flex-1 px-4 pb-4 pt-4 sm:px-5 sm:pb-5', bodyClassName)}>{children}</div>
  </section>
);
