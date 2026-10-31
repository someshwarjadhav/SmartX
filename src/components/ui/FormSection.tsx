import type * as React from 'react';
import { cn } from '../../lib/cn';

interface Props {
  step: number;
  title: string;
  description?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const FormSection: React.FC<Props> = ({ step, title, description, className, bodyClassName, children }) => (
  <section className={className}>
    <header className="mb-3.5 flex items-center gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink shadow-card">{step}</span>
      <div className="min-w-0">
        <h3 className="font-display text-sm font-semibold leading-tight">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-mute">{description}</p>}
      </div>
    </header>
    <div className={cn('sm:pl-10', bodyClassName)}>{children}</div>
  </section>
);
