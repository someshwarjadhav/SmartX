import type * as React from 'react';
import { cn } from '../../lib/cn';
import { Dropdown } from './Dropdown';

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}

export const Select: React.FC<Props> = ({ value, onChange, options, label, icon, className }) => (
  <div className={cn('relative', className)}>
    {icon && <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-mute">{icon}</span>}
    <Dropdown
      value={value}
      onChange={onChange}
      options={options}
      aria-label={label}
      className={cn(
        'h-10 w-full rounded-xl border border-line bg-panel pr-9 text-sm font-semibold text-ink outline-none transition hover:border-brand/50 focus:border-brand focus:ring-4 focus:ring-brand/15',
        icon ? 'pl-9' : 'pl-3',
      )}
    />
  </div>
);
