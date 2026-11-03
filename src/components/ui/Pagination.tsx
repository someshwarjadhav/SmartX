import type * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { PAGE_SIZES } from '../../hooks/usePagination';
import { Select } from './Select';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  sizes?: number[];
  showSize?: boolean;
}

export function pagesToShow(page: number, count: number): Array<number | '…'> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: Array<number | '…'> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < count - 1) out.push('…');
  out.push(count);
  return out;
}

const btn =
  'grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';

export const Pagination: React.FC<Props> = ({ page, pageSize, total, onPage, onPageSize, sizes = PAGE_SIZES, showSize = true }) => {
  const count = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line px-4 py-3 sm:px-5">
      <p className="tnum text-sm text-mute">
        Showing <span className="font-semibold text-ink">{from}–{to}</span> of <span className="font-semibold text-ink">{total}</span>
      </p>

      <div className="flex items-center gap-1.5">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page" className={cn(btn, 'border-line bg-panel text-mute hover:border-brand/60 hover:text-ink')}>
          <ChevronLeft size={16} />
        </button>
        <span className="tnum px-2 text-sm font-semibold sm:hidden">
          {page} / {count}
        </span>
        <div className="hidden items-center gap-1.5 sm:flex">
          {pagesToShow(page, count).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1 text-mute" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={cn(btn, p === page ? 'border-brand bg-brand text-brand-ink shadow-card' : 'border-line bg-panel text-mute hover:border-brand/60 hover:text-ink')}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <button onClick={() => onPage(page + 1)} disabled={page >= count} aria-label="Next page" className={cn(btn, 'border-line bg-panel text-mute hover:border-brand/60 hover:text-ink')}>
          <ChevronRight size={16} />
        </button>
      </div>

      {showSize && (
        <Select
          label="Rows per page"
          value={String(pageSize)}
          onChange={(v) => onPageSize(Number(v))}
          options={sizes.map((s) => ({ value: String(s), label: `${s} per page` }))}
          className="w-36"
        />
      )}
    </nav>
  );
};
