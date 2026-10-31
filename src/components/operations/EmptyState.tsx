import type * as React from 'react';
import type { ReactNode } from 'react';
import { MilkCan } from './Illustrations';

export const EmptyState: React.FC<{ title: string; hint?: string; action?: ReactNode }> = ({ title, hint, action }) => {
  return (
    <div className="grid place-items-center gap-2 px-6 py-14 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/10"><MilkCan size={44} className="animate-drift" /></span>
      <p className="mt-1 font-display text-lg font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-mute">{hint}</p>}
      {action}
    </div>
  );
};
