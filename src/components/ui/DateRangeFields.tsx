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

  // While a date is being TYPED nothing is corrected: the browser reports every half-typed value (typing the month "11"
  // first gives "01"), and pulling it back made manual typing impossible. The value is fixed when the field loses focus,
  // and a range that is still wrong is reported by the page's Submit check (validateDateRange / validatePastLimit).
  const changeFrom = (raw: string) => onChange({ from: raw });
  const changeTo = (raw: string) => onChange({ to: raw });

  const blurFrom = () => {
    if (!from) return;
    const v = clampDate(from, fromMin, ceil);
    const patch: { from?: string; to?: string } = {};
    if (v !== from) patch.from = v;
    if (v && to && to < v) patch.to = v; // To can never be before From
    if (patch.from !== undefined || patch.to !== undefined) onChange(patch);
  };

  const blurTo = () => {
    if (!to) return;
    // only the hard limits (older than the past limit / before From / future) are fixed here;
    // a gap longer than the allowed range is left for the Submit message so the person sees why
    const v = clampDate(to, toMin, ceil);
    if (v !== to) onChange({ to: v });
  };

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
        onBlur={blurFrom}
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
        onBlur={blurTo}
        error={error}
      />
    </div>
  );
};
