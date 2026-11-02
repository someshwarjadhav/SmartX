import { useMemo } from 'react';
import { useMilkFarmerEntries } from './useMilkReportData';
import { shortDate, toISO } from '../lib/format';

export type TrendDays = 7 | 14 | 30;
export const ALL_CENTRES = 'ALL';

export interface TrendPoint {
  label: string;
  Cow: number;
  Buffalo: number;
  Mix: number;
}

const plusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
};

/**
 * Daily litres by milk type for the "Milk collection" chart.
 * Always fetches the last 30 days for every centre once (cached by the query layer),
 * then filters by centre and by 7 / 14 / 30 days on the client, so changing the
 * dropdown or the range is instant and does not hit the portal again.
 */
export function useTrendData(days: TrendDays, centre: string) {
  const today = toISO(new Date());
  const from30 = plusDays(today, -29);
  const q = useMilkFarmerEntries({ from: from30, to: today, shift: 'both', milk: 'both' });

  const data = useMemo<TrendPoint[]>(() => {
    const rows = centre === ALL_CENTRES ? q.rows : q.rows.filter((r) => r.stationId === centre);
    const byDay = new Map<string, TrendPoint>();
    for (let i = days - 1; i >= 0; i--) {
      const date = plusDays(today, -i);
      byDay.set(date, { label: shortDate(date), Cow: 0, Buffalo: 0, Mix: 0 });
    }
    for (const r of rows) {
      const p = byDay.get(r.date);
      if (!p) continue;
      if (r.kind === 'cow') p.Cow += r.litres;
      else if (r.kind === 'buffalo') p.Buffalo += r.litres;
      else p.Mix += r.litres;
    }
    return [...byDay.values()];
  }, [q.rows, days, centre, today]);

  return { data, loading: q.loading, error: q.error };
}
