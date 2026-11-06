import type * as React from 'react';
import type { InputHTMLAttributes } from 'react';
import { Input } from './Fields';
import { MAX_PAST_MONTHS, earliestPastDate } from '../../../lib/dateRange';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  /** How far back a date can be picked, counted from today. Default 3 months. */
  pastMonths?: number;
};

/**
 * Drop-in replacement for <Input type="date" />.
 * Same props, same onChange(event) - the only difference is that a date older than
 * `pastMonths` months before today cannot be picked (the calendar greys it out, and a
 * date typed by hand is pulled back to the oldest allowed day).
 * Any min / max the page already passes is kept as it is.
 */
export const PastDateInput: React.FC<Props> = ({ pastMonths = MAX_PAST_MONTHS, min, onChange, ...rest }) => {
  const floor = earliestPastDate(pastMonths);
  const lowest = typeof min === 'string' && min > floor ? min : floor;
  return (
    <Input
      {...rest}
      type="date"
      min={lowest}
      onChange={(e) => {
        // the page's own handler reads e.target.value, so it gets the corrected date
        if (e.target.value && e.target.value < floor) e.target.value = floor;
        onChange?.(e);
      }}
    />
  );
};
