import type * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'soft' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink shadow-card hover:brightness-110 active:brightness-95',
  soft: 'bg-brand/10 text-brand hover:bg-brand/15',
  outline: 'border border-line bg-panel text-ink hover:border-brand/60',
  ghost: 'text-mute hover:bg-soft hover:text-ink',
  danger: 'bg-danger text-white shadow-card hover:brightness-110 active:brightness-95',
  success: 'bg-ok text-white shadow-card hover:brightness-110 active:brightness-95',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-sm',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-base',
};

export const Button: React.FC<Props> = ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest }) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={cn(
      'inline-flex select-none items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
      VARIANTS[variant],
      SIZES[size],
      className,
    )}
    {...rest}
  >
    {loading ? <Loader2 size={16} className="animate-spin360" aria-hidden /> : icon}
    {children}
  </button>
);
