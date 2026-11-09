import type * as React from 'react';
import { runSpans } from '../../assets/excel/exporters';
import { cn } from '../../lib/cn';
import { clipTitle } from '../../lib/clipTitle';

type Align = 'left' | 'right' | 'center';

export interface GroupColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: Align;
  /**
   * Makes this column a "group" column (STIPL style): consecutive rows with the same key share ONE merged cell.
   * The key must include the parent groups too, e.g. date column key = `${vlcc}|${date}`.
   */
  group?: (row: T) => string;
  className?: (row: T) => string | undefined;
  /** fixed width in px: a longer value is cut with "..." (hover shows the full text) */
  width?: number;
}

interface Props<T> {
  columns: GroupColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  ariaLabel: string;
  /** extra header row above the column names: [{ label: 'DOC Collection', span: 5 }] (use label '' for a blank block) */
  headerGroups?: Array<{ label: string; span: number }>;
  footer?: React.ReactNode;
  minWidth?: number;
}

const ALIGN: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' };
const CELL = 'border border-line px-2.5 py-2';
const fixed = (w?: number): React.CSSProperties | undefined => (w ? { width: w, minWidth: w, maxWidth: w } : undefined);

/**
 * Report table with merged (rowSpan) group cells and an optional two-level header - the same layout the STIPL
 * Variance / VLCC collection reports use. Reusable for any report that repeats a parent value over many rows.
 */
export function GroupedTable<T>({ columns, rows, rowKey, ariaLabel, headerGroups, footer, minWidth = 900 }: Props<T>) {
  // span of every group cell: first row of a run = run length, the rest = 0 (cell not drawn)
  const spans = columns.map((c) => (c.group ? runSpans(rows.map((r) => c.group!(r))) : null));

  return (
    <div className="scroll-x">
      <table aria-label={ariaLabel} className="clip-cells w-full border-collapse text-sm" style={{ minWidth }} onMouseOver={clipTitle}>
        <thead>
          {headerGroups && (
            <tr>
              {headerGroups.map((g, i) => (
                <th key={`${g.label}-${i}`} colSpan={g.span} className={cn('whitespace-nowrap border border-line px-3 py-2.5 text-center text-xs font-bold', g.label ? 'bg-brand/[0.08] text-brand' : '')}>
                  {g.label}
                </th>
              ))}
            </tr>
          )}
          <tr className="bg-soft/40">
            {columns.map((c) => (
              <th key={c.key} scope="col" style={fixed(c.width)} className={cn('whitespace-nowrap border border-line px-2.5 py-2.5 text-xs font-semibold text-mute', ALIGN[c.align ?? 'left'])}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={rowKey(row)}>
              {columns.map((c, ci) => {
                const span = spans[ci]?.[ri];
                if (span === 0) return null; // covered by the merged cell above
                return (
                  <td
                    key={c.key}
                    style={fixed(c.width)}
                    rowSpan={span && span > 1 ? span : undefined}
                    className={cn(CELL, 'whitespace-nowrap', ALIGN[c.align ?? 'left'], c.group && 'align-middle font-semibold', c.className?.(row))}
                  >
                    {c.cell(row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  );
}
