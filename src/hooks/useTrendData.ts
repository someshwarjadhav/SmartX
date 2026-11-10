import { useMemo } from "react";
import { useMilkFarmerEntries } from "./useMilkReportData";
import { shortDate, toISO } from "../lib/format";

export type TrendDays = 1 | 10 | 20 | 30;
export const ALL_CENTRES = "ALL";

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

export function useTrendData(days: TrendDays, centre: string) {
  const today = toISO(new Date());
  const from = plusDays(today, -(days - 1));
  const q = useMilkFarmerEntries({
    from,
    to: today,
    shift: "both",
    milk: "both",
  });

  const data = useMemo<TrendPoint[]>(() => {
    const rows =
      centre === ALL_CENTRES
        ? q.rows
        : q.rows.filter((r) => r.stationId === centre);
    const add = (p: TrendPoint, r: (typeof rows)[number]) => {
      if (r.kind === "cow") p.Cow += r.litres;
      else if (r.kind === "buffalo") p.Buffalo += r.litres;
      else p.Mix += r.litres;
    };
    if (days === 1) {
      const shifts: Record<"Morning" | "Evening", TrendPoint> = {
        Morning: { label: "Morning", Cow: 0, Buffalo: 0, Mix: 0 },
        Evening: { label: "Evening", Cow: 0, Buffalo: 0, Mix: 0 },
      };
      for (const r of rows) if (r.date === today) add(shifts[r.shift], r);
      return [shifts.Morning, shifts.Evening];
    }
    const byDay = new Map<string, TrendPoint>();
    for (let i = days - 1; i >= 0; i--) {
      const date = plusDays(today, -i);
      byDay.set(date, { label: shortDate(date), Cow: 0, Buffalo: 0, Mix: 0 });
    }
    for (const r of rows) {
      const p = byDay.get(r.date);
      if (p) add(p, r);
    }
    return [...byDay.values()];
  }, [q.rows, days, centre, today]);

  return { data, loading: q.loading, error: q.error };
}
