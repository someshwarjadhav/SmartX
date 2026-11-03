import type * as React from 'react';

/** Shown when some API requests still failed after a retry, so the totals below may be incomplete. */
export const PartialNotice: React.FC<{ failed: number; total: number; onRetry: () => void }> = ({ failed, total, onRetry }) =>
  failed > 0 ? (
    <div role="alert" className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
      {failed} of {total} server requests did not answer, so some centres may be missing from this report.
      <button type="button" className="ml-2 font-semibold underline" onClick={onRetry}>Reload</button>
    </div>
  ) : null;
