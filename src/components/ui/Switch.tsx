import type * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}

export const Switch: React.FC<Props> = ({ checked, onChange, label, hint }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="group flex items-center gap-3 text-left"
  >
    <span className={cn('flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors', checked ? 'justify-end bg-ok' : 'justify-start bg-line')}>
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} className="h-5 w-5 rounded-full bg-white shadow" />
    </span>
    <span>
      <span className="block text-sm font-semibold leading-tight">{label}</span>
      {hint && <span className="block text-xs text-mute">{hint}</span>}
    </span>
  </button>
);
