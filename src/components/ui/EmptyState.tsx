import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { SearchX } from 'lucide-react';

interface Props {
  title: string;
  text?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<Props> = ({ title, text, icon: Icon = SearchX, action }) => (
  <div className="grid place-items-center px-6 py-16 text-center">
    <div className="max-w-xs">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
        <Icon size={26} aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1.5 text-sm text-mute">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  </div>
);
