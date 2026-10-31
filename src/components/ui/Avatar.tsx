import type * as React from 'react';
import { UserPlus } from 'lucide-react';
import { initials } from '../../lib/format';
import { cn } from '../../lib/cn';

type Size = 'sm' | 'md' | 'lg';

interface Props {
  name: string;
  size?: Size;
  className?: string;
}

const TONES = ['bg-brand/12 text-brand', 'bg-ok/12 text-ok', 'bg-warn/15 text-warn', 'bg-danger/12 text-danger', 'bg-mix/15 text-mix', 'bg-cow/15 text-cow'];

const SIZES: Record<Size, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-lg',
};

const toneOf = (name: string): string => TONES[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % TONES.length] ?? TONES[0]!;

export const Avatar: React.FC<Props> = ({ name, size = 'md', className }) => {
  const blank = name.trim() === '';
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full font-bold transition-colors', SIZES[size], blank ? 'bg-white/15 text-white' : toneOf(name), className)}
      aria-hidden
    >
      {blank ? <UserPlus size={size === 'lg' ? 22 : 16} /> : initials(name)}
    </span>
  );
};
