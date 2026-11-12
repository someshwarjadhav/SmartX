import type * as React from 'react';
import { Children, Fragment, isValidElement } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '../../../lib/portal/cn';
import { Dropdown, type DropdownOption } from '../../ui/Dropdown';

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

const textOf = (n: ReactNode): string =>
  Children.toArray(n)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : isValidElement(c) ? textOf((c.props as { children?: ReactNode }).children) : ''))
    .join('');

/** the <option> children of a <Select> (also inside fragments / optgroups / .map()) as a list for the Dropdown */
function optionsOf(children: ReactNode, out: DropdownOption[] = []): DropdownOption[] {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const props = c.props as { value?: unknown; disabled?: boolean; children?: ReactNode };
    if (c.type === 'option') {
      const label = textOf(props.children);
      out.push({ value: props.value !== undefined && props.value !== null ? String(props.value) : label, label, disabled: props.disabled });
    } else if (c.type === Fragment || c.type === 'optgroup') {
      optionsOf(props.children, out);
    }
  });
  return out;
}

/**
 * Written exactly like the old native select (<Select value onChange={(e) => ... e.target.value}><option .../></Select>),
 * so no page had to change - it is drawn with the shared Dropdown (rounded list, tick, scroll bar, search for long lists).
 */
export const Select: React.FC<SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, value, onChange, disabled, id, name, required, autoFocus, onBlur, onFocus, ...rest }) => {
  const v = value === undefined || value === null ? '' : String(Array.isArray(value) ? (value[0] ?? '') : value);
  return (
    <div className="relative">
      <Dropdown
        id={id}
        name={name}
        value={v}
        options={optionsOf(children)}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        aria-label={rest['aria-label']}
        onBlur={onBlur as never}
        onFocus={onFocus as never}
        invalid={rest['aria-invalid'] === true || rest['aria-invalid'] === 'true'}
        onChange={(next) =>
          onChange?.({ target: { value: next, name: name ?? '' }, currentTarget: { value: next, name: name ?? '' } } as unknown as React.ChangeEvent<HTMLSelectElement>)
        }
        className={cn(base, 'pr-9', className)}
      />
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
