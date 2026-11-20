import type * as React from "react";
import { useState } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { TextField } from "./Fields";
import {
  MAX_PAST_MONTHS,
  MAX_RANGE_MONTHS,
  addMonthsISO,
  clampDate,
  earliestPastDate,
  todayISO,
} from "../../lib/dateRange";

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

const smaller = (a?: string, b?: string): string | undefined =>
  a && b ? (a < b ? a : b) : (a ?? b);

export const DateRangeFields: React.FC<DateRangeFieldsProps> = ({
  from,
  to,
  onChange,
  error,
  pastMonths = MAX_PAST_MONTHS,
  maxRangeMonths = MAX_RANGE_MONTHS,
  allowFuture = true,
  fromLabel = "From Date",
  toLabel = "To Date",
  className,
}) => {
  const floor = earliestPastDate(pastMonths);
  const ceil = allowFuture ? undefined : todayISO();

  const fromMin = floor;
  const fromMax = smaller(to || undefined, ceil);
  const toMin = from && from > floor ? from : floor;
  const toMax = smaller(
    from ? addMonthsISO(from, maxRangeMonths) : undefined,
    ceil,
  );

  const [notice, setNotice] = useState<string | undefined>();
  const show = (iso: string) => iso.split("-").reverse().join("-"); // yyyy-MM-dd -> dd-MM-yyyy

  const changeFrom = (raw: string) => {
    setNotice(undefined);
    onChange({ from: raw });
  };
  const changeTo = (raw: string) => {
    setNotice(undefined);
    onChange({ to: raw });
  };

  const blurFrom = () => {
    if (!from) return;
    const v = clampDate(from, fromMin, ceil);
    const patch: { from?: string; to?: string } = {};
    let note: string | undefined;
    if (v !== from) {
      patch.from = v;
      note = `Dates older than ${pastMonths} months are not allowed. `;
    }
    if (v && to) {
      let nextTo = to;
      if (nextTo < v) nextTo = v; // To can never be before From
      const limit = smaller(addMonthsISO(v, maxRangeMonths), ceil);
      if (limit && nextTo > limit) {
        nextTo = limit; // the gap can never be longer than the allowed range
        note = `Maximum ${maxRangeMonths} months allowed. To Date set to ${show(limit)}.`;
      }
      if (nextTo !== to) patch.to = nextTo;
    }
    if (patch.from !== undefined || patch.to !== undefined) onChange(patch);
    setNotice(note);
  };

  const blurTo = () => {
    if (!to) return;
    // fixes all hard limits: before From / older than the past limit / future (if blocked) / longer than the allowed range
    const v = clampDate(to, toMin, toMax);
    if (v !== to) {
      onChange({ to: v });
      setNotice(
        to > v
          ? `Maximum ${maxRangeMonths} months allowed. To Date set to ${show(v)}.`
          : `To Date cannot be before ${show(v)}, so it was corrected.`,
      );
    }
  };

  return (
    <div
      className={
        className ??
        "grid grid-cols-1 items-start gap-2 min-[480px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
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
      <ArrowRight
        size={16}
        className="mt-[2.4rem] hidden text-mute min-[480px]:block"
        aria-hidden
      />
      <TextField
        label={toLabel}
        type="date"
        icon={<CalendarDays size={16} />}
        value={to}
        min={toMin}
        max={toMax}
        onChange={(e) => changeTo(e.target.value)}
        onBlur={blurTo}
        error={error ?? notice}
      />
    </div>
  );
};
