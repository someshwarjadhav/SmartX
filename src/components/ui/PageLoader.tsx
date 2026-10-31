import type * as React from 'react';
import { LogoMark } from '../brand/Logo';

export const PageLoader: React.FC<{ full?: boolean }> = ({ full }) => (
  <div className={`grid place-items-center ${full ? 'min-h-dvh' : 'min-h-[40vh]'}`} role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <span className="absolute inset-0 animate-pulseDot rounded-2xl bg-brand/40" aria-hidden />
        <LogoMark size={52} className="relative" />
      </div>
      <p className="text-sm font-semibold text-mute">Loading SmartX…</p>
    </div>
  </div>
);
