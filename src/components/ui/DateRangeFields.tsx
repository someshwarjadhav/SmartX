import type * as React from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { TextField } from './Fields';
import {
  MAX_PAST_MONTHS,
  MAX_RANGE_MONTHS,
  addMonthsISO,
  clampDate,
  earliestPastDate,
  todayISO,
} from '../../lib/dateRange';

interface DateRangeFieldsProps {
  from: string;
  to: string;
  onChange: (patch: { from?: string; to?: string }) => void;
  error?: string;
  /** How far back a date can be picked, counted from today. Default 3 months. */
  pastMonths?: number;
  /** Max gap between From and To. Default 3 months. */
  maxRangeMonths?: number;
  /** Set false to block future dates. By default they stay allowed, as before. */
  allowFuture?: boolean;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}

const smaller = (a?: string, b?: string): string | undefined => (a && b ? (a < b ? a : b) : a ?? b);

/**
 * From Date -> To Date pair.
 *  - nothing older than `pastMonths` months before today can be picked
 *  - future dates stay allowed unless allowFuture={false}
 *  - From <= To, and the gap is at most `maxRangeMonths`
 * The browser's min/max only grey out the calendar; typing a date by hand can skip them,
 * so every value is also clamped here.
 */
export const DateRangeFields: React.FC<DateRangeFieldsProps> = ({
  from,
  to,
  onChange,
  error,
  pastMonths = MAX_PAST_MONTHS,
  maxRangeMonths = MAX_RANGE_MONTHS,
  allowFuture = true,
  fromLabel = 'From Date',
  toLabel = 'To Date',
  className,
}) => {
  const floor = earliestPastDate(pastMonths);
  const ceil = allowFuture ? undefined : todayISO();

  const fromMin = floor;
  const fromMax = smaller(to || undefined, ceil);
  const toMin = from && from > floor ? from : floor;
  const toMax = smaller(from ? addMonthsISO(from, maxRangeMonths) : undefined, ceil);

  const changeFrom = (raw: string) => {
    const v = clampDate(raw, fromMin, ceil);
    const patch: { from?: string; to?: string } = { from: v };
    if (v && to) {
      if (to < v) patch.to = v; // To can never be before From
      else {
        const limit = addMonthsISO(v, maxRangeMonths);
        if (to > limit) patch.to = limit; // keep the gap inside the allowed range
      }
    }
    onChange(patch);
  };

  const changeTo = (raw: string) => onChange({ to: clampDate(raw, toMin, toMax) });

  return (
    <div
      className={
        className ??
        'grid grid-cols-1 items-start gap-2 min-[480px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
      }
    >
      <TextField
        label={fromLabel}
        type="date"
        icon={<CalendarDays size={16} />}
        value={from}
        min={fromMin}
        max={fromMax}
        onChange={(e) => changeFrom(e.target.value)}
      />
      <ArrowRight size={16} className="mt-[2.4rem] hidden text-mute min-[480px]:block" aria-hidden />
      <TextField
        label={toLabel}
        type="date"
        icon={<CalendarDays size={16} />}
        value={to}
        min={toMin}
        max={toMax}
        onChange={(e) => changeTo(e.target.value)}
        error={error}
      />
    </div>
  );
};
