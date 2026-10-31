import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

type Tone = 'brand' | 'danger';

interface Props extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  tone?: Tone;
}

const TONES: Record<Tone, string> = {
  brand: 'text-brand hover:bg-brand/10',
  danger: 'text-mute hover:bg-danger/10 hover:text-danger',
};

export const IconButton: React.FC<Props> = ({ icon: Icon, label, tone = 'brand', className, type = 'button', ...rest }) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={cn('grid h-8 w-8 place-items-center rounded-lg transition active:scale-95 disabled:opacity-50', TONES[tone], className)}
    {...rest}
  >
    <Icon size={16} aria-hidden />
  </button>
);
