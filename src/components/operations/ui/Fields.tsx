import type * as React from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/portal/cn';

const base =
  'h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-base text-ink outline-none placeholder:text-mute/70 transition hover:border-brand/50 focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-soft/60 disabled:opacity-70 sm:text-sm';

export const Field: React.FC<{ label: string; hint?: string; children: ReactNode; className?: string }> = ({ label, hint, children, className }) => {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}
    </label>
  );
};

export const Input: React.FC<InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }> = ({ className, icon, ...rest }) => {
  if (!icon) return <input {...rest} className={cn(base, className)} />;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute">{icon}</span>
      <input {...rest} className={cn(base, 'pl-9', className)} />
    </div>
  );
};

export const Select: React.FC<SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...rest }) => {
  return (
    <div className="relative">
      <select {...rest} className={cn(base, 'appearance-none pr-9', className)}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute" />
    </div>
  );
};

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-xl border border-line bg-soft/70 p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 rounded-lg px-3 text-sm font-semibold transition',
            value === o.value ? 'bg-panel text-brand shadow-card' : 'text-mute hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
