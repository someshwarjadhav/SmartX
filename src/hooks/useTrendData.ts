import { useMemo } from "react";
import { useMilkFarmerEntries } from "./useMilkReportData";

export const ALL_CENTRES = "ALL";

export interface TrendPoint {
  label: string;
  Cow: number;
  Buffalo: number;
  Mix: number;
}

export function useTrendData(date: string, centre: string) {
  const q = useMilkFarmerEntries({
    from: date,
    to: date,
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
    const shifts: Record<"Morning" | "Evening", TrendPoint> = {
      Morning: { label: "Morning", Cow: 0, Buffalo: 0, Mix: 0 },
      Evening: { label: "Evening", Cow: 0, Buffalo: 0, Mix: 0 },
    };
    for (const r of rows) if (r.date === date) add(shifts[r.shift], r);
    return [shifts.Morning, shifts.Evening];
  }, [q.rows, centre, date]);

  return { data, loading: q.loading, error: q.error };
}
