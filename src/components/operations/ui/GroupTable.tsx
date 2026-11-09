import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '../../../lib/portal/cn';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../../lib/portal/global';
import { PageBar } from './PageBar';
import { TableTopBar } from './ResultPerPage';
import { EmptyState } from '../EmptyState';
import { clipTitle } from '../../../lib/clipTitle';

export interface GCol<T> {
  key: string;
  header: ReactNode;
  group?: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface Props<T> {
  columns: GCol<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  pageSize?: number;
  pageSizes?: number[];
  sizeLabel?: string;
 
  footer?: ReactNode;
  empty?: ReactNode;
}

const alignOf = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');
const TH = 'whitespace-nowrap border-b border-line bg-soft/70 px-2.5 py-3 text-xs font-semibold text-mute';


export function GroupTable<T>({ columns, rows, rowKey, pageSize = DEFAULT_PAGE_SIZE, footer, empty }: Props<T>) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE);
  useEffect(() => setPage(0), [rows.length, size]);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * size, cur * size + size);
  const grouped = columns.some((c) => c.group);

  const top = useMemo(() => {
    const out: ReactNode[] = [];
    for (let i = 0; i < columns.length; ) {
      const c = columns[i];
      if (!c.group) {
        out.push(<th key={c.key} rowSpan={grouped ? 2 : 1} scope="col" className={cn(TH, 'border-r border-line/60', alignOf(c.align))}>{c.header}</th>);
        i++;
        continue;
      }
      let n = 1;
      while (i + n < columns.length && columns[i + n].group === c.group) n++;
      out.push(<th key={`g-${c.group}-${i}`} colSpan={n} scope="colgroup" className={cn(TH, 'border-x border-line/60 text-center text-sm text-ink')}>{c.group}</th>);
      i += n;
    }
    return out;
  }, [columns, grouped]);

  return (
    <div>
      {rows.length > 0 && <TableTopBar total={rows.length} page={cur + 1} size={size} onSize={setSize} />}
      <div className="overflow-x-auto">
        <table className="clip-cells w-full border-separate border-spacing-0 text-[13px]" onMouseOver={clipTitle}>
          <thead>
            <tr>{top}</tr>
            {grouped && (
              <tr>
                {columns.filter((c) => c.group).map((c) => (
                  <th key={c.key} scope="col" className={cn(TH, alignOf(c.align))}>{c.header}</th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={rowKey(r)} className="transition-colors hover:bg-brand/[0.06]">
                {columns.map((c) => (
                  <td key={c.key} className={cn('whitespace-nowrap border-b border-line/70 px-2.5 py-2.5 tnum', alignOf(c.align), c.className)}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
            {footer}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (empty ?? <EmptyState title="No records for these filters" hint="Widen the date range or pick another centre." />)}
      {rows.length > 0 && <PageBar total={rows.length} page={cur + 1} size={size} onPage={(p) => setPage(p - 1)} />}
    </div>
  );
}
