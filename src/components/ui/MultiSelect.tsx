import type * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { Option } from '../../data/masters';

interface Props {
  label: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: string;
  wrapperClassName?: string;
}

/** Dropdown with check boxes: the chosen ids show as small chips inside the field. */
export const MultiSelect: React.FC<Props> = ({ label, options, value, onChange, placeholder = 'Select…', error, wrapperClassName }) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const chosen = options.filter((o) => value.includes(o.value));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const allOn = options.length > 0 && chosen.length === options.length;

  return (
    <div ref={root} className={cn('relative block min-w-0', wrapperClassName)}>
      <span id={`${id}-l`} className="mb-1.5 block text-sm font-semibold">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-l`}
        aria-invalid={error ? true : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 rounded-xl border border-line bg-panel px-3 py-1.5 text-left text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 aria-[invalid=true]:border-danger sm:text-sm',
          open && 'border-brand ring-4 ring-brand/15',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {chosen.length === 0 ? (
            <span className="text-mute/80">{placeholder}</span>
          ) : (
            <>
              {chosen.slice(0, 3).map((o) => (
                <span key={o.value} className="tnum rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">{o.value}</span>
              ))}
              {chosen.length > 3 && <span className="text-xs font-semibold text-mute">+{chosen.length - 3} more</span>}
            </>
          )}
        </span>
        <ChevronDown size={16} className={cn('shrink-0 text-mute transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div role="listbox" aria-multiselectable="true" aria-labelledby={`${id}-l`} className="absolute left-0 right-0 z-30 mt-1.5 max-h-72 min-w-[15rem] overflow-y-auto rounded-xl border border-line bg-panel p-1.5 shadow-pop">
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-line px-2 pb-1.5">
            <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => onChange(allOn ? [] : options.map((o) => o.value))}>
              {allOn ? 'Clear all' : 'Select all'}
            </button>
            <span className="text-xs text-mute">{chosen.length} of {options.length}</span>
          </div>
          {options.length === 0 && <p className="px-2 py-3 text-sm text-mute">No centres found.</p>}
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <label key={o.value} role="option" aria-selected={on} className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-brand/[0.07]', on && 'bg-brand/[0.08] font-semibold')}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(o.value)} />
                <span className={cn('grid h-4.5 w-4.5 shrink-0 place-items-center rounded border', on ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-panel')} style={{ width: 18, height: 18 }} aria-hidden>
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0 truncate">{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {error && <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
};
