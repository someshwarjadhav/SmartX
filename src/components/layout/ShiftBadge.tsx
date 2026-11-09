import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Sunrise, Sunset } from 'lucide-react';
import { currentShift, SHIFT_WINDOW } from '../../lib/shift';
import { cn } from '../../lib/cn';

/** Top-right chip: which shift is running now. Evening runs 4 PM to 2 AM, Morning runs 2 AM to 4 PM. */
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
      title={`${shift} shift: ${SHIFT_WINDOW[shift]}`}
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
