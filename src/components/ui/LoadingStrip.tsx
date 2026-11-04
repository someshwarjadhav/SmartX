import type * as React from 'react';

interface Props {
  /** show the strip only while requests are still running */
  active: boolean;
  done: number;
  total: number;
  label?: string;
}

/**
 * Thin progress strip shown above a report table while the rest of the centres are still loading.
 * The rows that already arrived stay on screen, so the table never sits behind a full-page loader.
 */
export const LoadingStrip: React.FC<Props> = ({ active, done, total, label = 'Loading more records' }) => {
  if (!active) return null;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div role="status" aria-live="polite" className="border-b border-line bg-brand/[0.04] px-4 py-2 sm:px-5">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-mute">
        <span>{label}…</span>
        {total > 0 && <span className="tnum">{done} / {total}</span>}
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-brand/15">
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.max(pct, 8)}%` }} />
      </div>
    </div>
  );
};
