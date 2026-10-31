import type * as React from 'react';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useCountUp } from '../hooks';
import { cn } from '../../../lib/portal/cn';
import { nf } from '../../../lib/portal/format';
import { Skeleton } from '../Widget';

export const Sparkline: React.FC<{ values: number[]; color?: string; height?: number }> = ({ values, color = 'currentColor', height = 36 }) => {
  if (values.length < 2) return null;
  const w = 120;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - 4 - ((v - min) / span) * (height - 8)}`);
  const d = 'M' + pts.join(' L');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={`${d} L${w},${height} L0,${height} Z`} fill={color} opacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

interface Props {
  label: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  icon: ReactNode;
  tone?: string;
  delta?: number;
  spark?: number[];
  hint?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;

  idle?: boolean;

  compact?: boolean;
}

const bigIcon = (icon: ReactNode) => (isValidElement(icon) ? cloneElement(icon as ReactElement<{ size?: number; strokeWidth?: number }>, { size: 26, strokeWidth: 1.8 }) : icon);

const TILE: Array<[string, string, string]> = [
  ['danger', 'from-danger to-danger/70 text-white', 'from-danger to-danger/30'],
  ['warn', 'from-warn to-warn/70 text-white', 'from-warn to-warn/30'],
  ['ok', 'from-ok to-ok/70 text-white', 'from-ok to-ok/30'],
];
const toneOf = (tone?: string): [string, string] => {
  const hit = TILE.find(([k]) => tone?.includes(k));
  return hit ? [hit[1], hit[2]] : ['from-brand to-brand/70 text-brand-ink', 'from-brand to-glow'];
};

export const StatCard: React.FC<Props> = ({ label, value, decimals = 0, prefix = '', suffix = '', icon, tone, delta, spark, hint, loading, error, onRetry, idle, compact }) => {
  const v = useCountUp(value);
  const up = (delta ?? 0) >= 0;
  const [tile, line] = toneOf(tone);
  return (
    <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="flex min-w-0 flex-1">
        <div className={cn('relative grid shrink-0 place-items-center overflow-hidden bg-gradient-to-b', tile, compact ? 'w-14' : 'w-14 sm:w-20')}>
          <span className="pointer-events-none absolute inset-y-0 -left-full w-full skew-x-12 bg-white/25 transition-transform duration-700 group-hover:translate-x-[200%]" aria-hidden />
          <span className="relative">{bigIcon(icon)}</span>
        </div>
        <div className={cn('min-w-0 flex-1 px-3.5 pb-4 pt-3.5 sm:px-4', compact && 'pb-3 pt-3')}>
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-mute">{label}</p>
          <div className="mt-1 flex min-h-9 items-end">
            {idle ? (
              <p className="font-display text-3xl font-extrabold leading-none text-mute/50">—</p>
            ) : loading ? <Skeleton className="h-8 w-32" /> : error ? (
              <p className="text-sm text-mute">{error} {onRetry && <button onClick={onRetry} className="font-semibold text-brand underline">Retry</button>}</p>
            ) : (
              <div className="flex min-w-0 items-end gap-2">
                <p className="tnum truncate font-display text-2xl font-extrabold leading-tight sm:text-3xl">{prefix}{nf(v, decimals)}<span className="ml-1 text-base font-semibold text-mute">{suffix}</span></p>
                {delta !== undefined && (
                  <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold', up ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger')}>
                    {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(delta).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
          {(hint || idle) && <p className="mt-1 min-h-4 truncate text-xs text-mute">{idle ? 'Press Submit to load' : hint}</p>}
          {spark && !loading && !error && !idle && <div className="relative mt-1 text-brand"><Sparkline values={spark} /></div>}
        </div>
      </div>
      <span className={cn('absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r', line)} aria-hidden />
    </div>
  );
};
