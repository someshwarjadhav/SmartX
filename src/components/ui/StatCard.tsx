import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import { cn } from '../../lib/cn';

export type StatTone = 'brand' | 'ok' | 'warn' | 'danger';

interface Props {
  label: string;
  value: number;
  format: (n: number) => string;
  icon: LucideIcon;
  tone?: StatTone;
  note?: string;
  index?: number;
}

const TILE: Record<StatTone, string> = {
  brand: 'from-brand to-brand/70 text-brand-ink',
  ok: 'from-ok to-ok/70 text-white',
  warn: 'from-warn to-warn/70 text-white',
  danger: 'from-danger to-danger/70 text-white',
};

const LINE: Record<StatTone, string> = {
  brand: 'from-brand to-glow',
  ok: 'from-ok to-ok/30',
  warn: 'from-warn to-warn/30',
  danger: 'from-danger to-danger/30',
};

const DOT: Record<StatTone, string> = {
  brand: 'bg-brand',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
};

export const StatCard: React.FC<Props> = ({ label, value, format, icon: Icon, tone = 'brand', note, index = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: index * 0.07 }}
    whileHover={{ y: -4 }}
    className="group relative flex min-w-0 overflow-hidden rounded-2xl border border-line bg-panel shadow-card transition-shadow hover:shadow-pop"
  >
    <div className={cn('relative grid w-14 shrink-0 place-items-center overflow-hidden bg-gradient-to-b sm:w-20', TILE[tone])}>
      <span className="pointer-events-none absolute inset-y-0 -left-full w-full skew-x-12 bg-white/25 transition-transform duration-700 group-hover:translate-x-[200%]" aria-hidden />
      <Icon size={28} strokeWidth={1.8} className="relative transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" aria-hidden />
    </div>

    <div className="min-w-0 flex-1 px-3.5 pb-4 pt-3.5 sm:px-4">
      <p className="truncate text-[11px] font-bold uppercase tracking-wider text-mute">{label}</p>
      <p className="tnum mt-1 truncate font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        <AnimatedNumber value={value} format={format} />
      </p>
      {note && (
        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-mute">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[tone])} aria-hidden />
          {note}
        </p>
      )}
    </div>

    <motion.span
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.7, delay: 0.25 + index * 0.07, ease: 'easeOut' }}
      className={cn('absolute inset-x-0 bottom-0 h-1 origin-left bg-gradient-to-r', LINE[tone])}
      aria-hidden
    />
  </motion.div>
);
