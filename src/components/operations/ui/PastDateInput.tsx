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
 * `pastMonths` months before today cannot be picked (the calendar greys it out).
 *
 * A date TYPED by hand is never changed while the person is still typing: the browser fires a change for every
 * half-typed value (typing the month "11" first gives "01"), and pulling that value back made typing impossible.
 * The value is checked when the field loses focus: too old a date is moved to the oldest allowed day, and a date after
 * `max` is moved to `max`. A range that is still wrong is reported by the page when Submit is pressed.
 */
export const PastDateInput: React.FC<Props> = ({ pastMonths = MAX_PAST_MONTHS, min, max, onChange, onBlur, ...rest }) => {
  const floor = earliestPastDate(pastMonths);
  const lowest = typeof min === 'string' && min > floor ? min : floor;
  const highest = typeof max === 'string' && max ? max : undefined;
  return (
    <Input
      {...rest}
      type="date"
      min={lowest}
      max={highest}
      onChange={onChange}
      onBlur={(e) => {
        const el = e.currentTarget;
        const v = el.value;
        if (v && (v < floor || (highest && v > highest))) {
          el.value = v < floor ? floor : highest!;
          // the page's own handler reads e.target.value, so it gets the corrected date
          onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
        }
        onBlur?.(e);
      }}
    />
  );
};
