import type * as React from 'react';
import type { MilkKind } from '../../types';
import { cn } from '../../lib/cn';

export const KIND_LABEL: Record<MilkKind, string> = { cow: 'Cow', buffalo: 'Buffalo', mix: 'Mix' };
export const KIND_BG: Record<MilkKind, string> = { cow: 'bg-cow', buffalo: 'bg-buffalo', mix: 'bg-mix' };

export const KindChip: React.FC<{ kind: MilkKind; className?: string }> = ({ kind, className }) => (
  <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold text-mute', className)}>
    <span className={cn('h-2 w-2 rounded-full', KIND_BG[kind])} aria-hidden />
    {KIND_LABEL[kind]}
  </span>
);
