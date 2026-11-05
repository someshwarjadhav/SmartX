import type * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

type Tone = 'ok' | 'error' | 'warn' | 'info';

const LOOK: Record<Tone, { box: string; icon: React.ElementType; label: string }> = {
  ok: { box: 'border-ok/30 bg-ok/10 text-ok', icon: CheckCircle2, label: 'Success' },
  error: { box: 'border-danger/30 bg-danger/10 text-danger', icon: XCircle, label: 'Error' },
  warn: { box: 'border-warn/40 bg-warn/10 text-warn', icon: AlertTriangle, label: 'Warning' },
  info: { box: 'border-brand/30 bg-brand/10 text-brand', icon: Info, label: 'Info' },
};

interface Props {
  tone?: Tone;
  children: React.ReactNode;
  /** Shows a "Retry" style button on the right. */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** The one inline banner used for page-level problems (a failed load, a partial report...). */
export const InlineAlert: React.FC<Props> = ({ tone = 'error', children, actionLabel = 'Retry', onAction, className }) => {
  const look = LOOK[tone];
  const Icon = look.icon;
  return (
    <div role="alert" className={cn('flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm', look.box, className)}>
      <Icon size={18} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 font-medium text-ink">{children}</span>
      {onAction && (
        <button type="button" onClick={onAction} className="shrink-0 rounded-lg border border-current px-3 py-1 text-xs font-bold hover:bg-white/40">
          {actionLabel}
        </button>
      )}
    </div>
  );
};
