import type * as React from 'react';
import { useId } from 'react';

export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 40, className }) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--glow))" />
          <stop offset="1" stopColor="rgb(var(--brand))" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#lg-${id})`} />
      <path d="M32 10c9 11 16 18 16 27a16 16 0 0 1-32 0c0-9 7-16 16-27z" fill="#fff" />
      <path d="M24.5 30.5l15 15M39.5 30.5l-15 15" stroke="rgb(var(--brand))" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
};

export const Wordmark: React.FC<{ className?: string; tone?: 'light' | 'default' }> = ({ className = '', tone = 'default' }) => (
  <span className={`font-display text-xl font-extrabold tracking-tight ${tone === 'light' ? 'text-white' : 'text-ink'} ${className}`}>
    Smart<span className={tone === 'light' ? 'text-glow' : 'text-brand'}>X</span>
  </span>
);
