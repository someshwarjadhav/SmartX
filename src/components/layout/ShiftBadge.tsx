import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Sunrise, Sunset } from 'lucide-react';
import { currentShift } from '../../lib/shift';
import { cn } from '../../lib/cn';

/** Top-right chip: which shift is running now. Morning until 12 noon, Evening after that (a new shift starts at 4 AM). */
export const ShiftBadge: React.FC = () => {
  const [shift, setShift] = useState(() => currentShift());
  useEffect(() => {
    const tick = () => setShift(currentShift());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  const morning = shift === 'Morning';
  return (
    <span
      role="status"
      title={morning ? 'Morning shift: 4:00 AM to 12:00 noon' : 'Evening shift: from 12:00 noon'}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-semibold sm:h-9 sm:gap-1.5 sm:px-2.5',
        morning ? 'border-warn/30 bg-warn/10 text-warn' : 'border-brand/30 bg-brand/10 text-brand',
      )}
    >
      {morning ? <Sunrise size={14} aria-hidden /> : <Sunset size={14} aria-hidden />}
      <span className="hidden sm:inline">{shift} shift</span>
      <span className="sm:hidden">{morning ? 'Morning' : 'Evening'}</span>
    </span>
  );
};
