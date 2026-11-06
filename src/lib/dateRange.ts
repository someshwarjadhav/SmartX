/**
 * One rule for every From Date -> To Date filter in the project:
 *  - both dates must be chosen
 *  - From Date cannot be after To Date
 *  - the gap between the two dates can be at most MAX_RANGE_MONTHS (3) months
 *
 * Dates are plain "yyyy-MM-dd" strings (the value of <input type="date">).
 */
import { MSG } from './messages';

export const MAX_RANGE_MONTHS = 3;

const pad = (n: number): string => String(n).padStart(2, '0');

/** ISO date + N months. The day is kept (31 Jan + 1 month = 28/29 Feb, never rolls into March). */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
}

/** Latest To Date allowed for a From Date (use it as the `max` of the To Date input). */
export const maxToDate = (from: string, months = MAX_RANGE_MONTHS): string | undefined => (from ? addMonthsISO(from, months) : undefined);

/** Earliest From Date allowed for a To Date (use it as the `min` of the From Date input). */
export const minFromDate = (to: string, months = MAX_RANGE_MONTHS): string | undefined => (to ? addMonthsISO(to, -months) : undefined);

/** Returns the warning text to show, or null when the range is fine. */
export function validateDateRange(from: string, to: string, months = MAX_RANGE_MONTHS): string | null {
  if (!from || !to) return MSG.pickDates;
  if (from > to) return MSG.fromAfterTo;
  if (to > addMonthsISO(from, months)) return MSG.rangeTooLong(months);
  return null;
}
