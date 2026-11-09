import type * as React from 'react';
import { cn } from '../../lib/cn';
import { TableLoader } from './TableLoader';
import { clipTitle } from '../../lib/clipTitle';

type Align = 'left' | 'right' | 'center';
type MobileRole = 'title' | 'action' | 'data' | 'hidden';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: Align;
  mobile?: MobileRole;
  mobileLabel?: string;
  className?: string;
  /** fixed width in px: a longer value is cut with "..." (hover shows the full text) */
  width?: number;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  ariaLabel: string;
  loading?: boolean;
  minWidth?: number;
  isSelected?: (row: T) => boolean;
}

const ALIGN: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' };

const fixed = (w?: number): React.CSSProperties | undefined => (w ? { width: w, minWidth: w, maxWidth: w } : undefined);

const labelOf = <T,>(c: Column<T>): string => c.mobileLabel ?? (typeof c.header === 'string' ? c.header : c.key);

export function DataTable<T>({ columns, rows, rowKey, ariaLabel, loading = false, minWidth = 900, isSelected }: Props<T>) {
  if (loading) return <TableLoader label="Loading data…" />;

  const title = columns.find((c) => c.mobile === 'title');
  const action = columns.find((c) => c.mobile === 'action');
  const data = columns.filter((c) => (c.mobile ?? 'data') === 'data');

  return (
    <>
      <div className="scroll-x hidden md:block">
        <table aria-label={ariaLabel} className="clip-cells w-full text-sm" style={{ minWidth }} onMouseOver={clipTitle}>
          <thead>
            <tr className="border-b border-line bg-soft/40 text-xs text-mute">
              {columns.map((c) => (
                <th key={c.key} scope="col" style={fixed(c.width)} className={cn('whitespace-nowrap px-2.5 py-3 font-semibold first:pl-4 last:pr-4', ALIGN[c.align ?? 'left'])}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map((row) => (
              // plain rows: a fade-in on every row made the table flash each time rows were added or a page was changed
              <tr key={rowKey(row)} className={cn('transition-colors hover:bg-brand/5', isSelected?.(row) && 'bg-brand/[0.06]')}>
                {columns.map((c) => (
                  <td key={c.key} style={fixed(c.width)} className={cn('whitespace-nowrap px-2.5 py-2.5 first:pl-4 last:pr-4', ALIGN[c.align ?? 'left'], c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line/70 md:hidden">
        {rows.slice(0, 300).map((row) => (
          <li
            key={rowKey(row)}
            className={cn('px-4 py-3.5', isSelected?.(row) && 'bg-brand/[0.06]')}
          >
            {(title || action) && (
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0 font-semibold">{title?.cell(row)}</div>
                {action && <div className="flex shrink-0 items-center gap-2">{action.cell(row)}</div>}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs sm:grid-cols-3">
              {data.map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-mute">{labelOf(c)}</dt>
                  <dd className="tnum mt-0.5 truncate text-sm font-semibold">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
