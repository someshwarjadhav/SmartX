import type * as React from 'react';
import { cn } from '../../lib/cn';

export type Tone = 'brand' | 'ok' | 'warn' | 'danger' | 'neutral';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand/12 text-brand',
  ok: 'bg-ok/12 text-ok',
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/12 text-danger',
  neutral: 'bg-soft text-mute',
};

export const Badge: React.FC<{ tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }> = ({ tone = 'neutral', dot, className, children }) => (
  <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', TONES[tone], className)}>
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
    {children}
  </span>
);
