import { useMemo } from "react";
import type { ShiftName } from "../lib/shift";
import type { CentreRow, SupplierRow } from "../types";
import type { Summary } from "../data/dairy";
import { useMilkFarmerEntries } from "./useMilkReportData";
import { ALL_CENTRES } from "./useTrendData";
import { shortDate, toISO } from "../lib/format";

export interface TodayCentre {
  id: string;
  name: string;
  litres: number;
  fat: number;
  snf: number;
  amount: number;
  farmers: number;
}
const plusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
};
const delta = (now: number, prev: number) =>
  prev ? ((now - prev) / prev) * 100 : 0;
const weighted = (
  rows: Array<{ litres: number; fat: number; snf: number }>,
  field: "fat" | "snf",
) => {
  const l = rows.reduce((a, r) => a + r.litres, 0);
  return l ? rows.reduce((a, r) => a + r.litres * r[field], 0) / l : 0;
};
const series = (
  rows: Array<{
    date: string;
    litres: number;
    fat: number;
    snf: number;
    amount: number;
    farmerId: string;
    kind: string;
    shift: string;
  }>,
  from: string,
  to: string,
) => {
  const days: Array<{
    date: string;
    Cow: number;
    Buffalo: number;
    Mix: number;
    Fat: number;
    SNF: number;
    Morning: number;
    Evening: number;
    litres: number;
    amount: number;
    farmers: number;
  }> = [];
  for (let d = from; d <= to; d = plusDays(d, 1)) {
    const list = rows.filter((r) => r.date === d);
    const litres = list.reduce((a, r) => a + r.litres, 0);
    days.push({
      date: d,
      Cow: list
        .filter((r) => r.kind === "cow")
        .reduce((a, r) => a + r.litres, 0),
      Buffalo: list
        .filter((r) => r.kind === "buffalo")
        .reduce((a, r) => a + r.litres, 0),
      Mix: list
        .filter((r) => r.kind === "mix")
        .reduce((a, r) => a + r.litres, 0),
      Fat: weighted(list, "fat"),
      SNF: weighted(list, "snf"),
      Morning: list
        .filter((r) => r.shift === "Morning")
        .reduce((a, r) => a + r.litres, 0),
      Evening: list
        .filter((r) => r.shift === "Evening")
        .reduce((a, r) => a + r.litres, 0),
      litres,
      amount: list.reduce((a, r) => a + r.amount, 0),
      farmers: new Set(list.map((r) => r.farmerId)).size,
    });
  }
  return days;
};

export function useDashboardData(
  date: string,
  shift: ShiftName,
  centre: string = ALL_CENTRES,
) {
  const prevDate = plusDays(date, -1);
  const current = useMilkFarmerEntries({
    from: date,
    to: date,
    shift: "both",
    milk: "both",
  });
  const previous = useMilkFarmerEntries({
    from: prevDate,
    to: prevDate,
    shift: "both",
    milk: "both",
  });
  return useMemo(() => {
    const pick = <T extends { stationId: string }>(rows: T[]) =>
      centre === ALL_CENTRES ? rows : rows.filter((r) => r.stationId === centre);
    const curRows = pick(current.rows);
    const prevRows = pick(previous.rows);
    const normalize = (rows: typeof current.rows) =>
      rows.map((r) => ({
        date: r.date,
        litres: r.litres,
        fat: r.fat,
        snf: r.snf,
        amount: r.amount,
        farmerId: `${r.stationId}:${r.farmerId}`,
        farmer: r.farmer,
        kind: r.kind,
        shift: r.shift,
        stationId: r.stationId,
        centre: r.centre,
        rate: r.rate,
      }));
    const allShifts = normalize(curRows);
    const c = allShifts.filter((r) => r.shift === shift),
      p = normalize(prevRows).filter((r) => r.shift === shift),
      daily = series(c, date, date),
      prior = series(p, prevDate, prevDate),
      bothShifts = series(allShifts, date, date);
    const total = (xs: typeof daily, key: "litres" | "amount") =>
      xs.reduce((a, r) => a + r[key], 0);
    const avgFarmers = (xs: typeof daily) =>
      xs.length ? xs.reduce((a, r) => a + r.farmers, 0) / xs.length : 0;
    const curLit = total(daily, "litres"),
      prevLit = total(prior, "litres"),
      curAmt = total(daily, "amount"),
      prevAmt = total(prior, "amount");
    const curFat = weighted(c, "fat"),
      prevFat = weighted(p, "fat"),
      curSnf = weighted(c, "snf"),
      prevSnf = weighted(p, "snf");
    const curFarm = avgFarmers(daily),
      prevFarm = avgFarmers(prior);
    const kpi = (value: number, before: number, spark: number[]) => ({
      value,
      delta: delta(value, before),
      spark,
    });
    const summary: Summary = {
      litres: kpi(
        curLit,
        prevLit,
        daily.map((x) => x.litres),
      ),
      fat: kpi(
        curFat,
        prevFat,
        daily.map((x) => x.Fat),
      ),
      snf: kpi(
        curSnf,
        prevSnf,
        daily.map((x) => x.SNF),
      ),
      farmers: kpi(
        curFarm,
        prevFarm,
        daily.map((x) => x.farmers),
      ),
      amount: kpi(
        curAmt,
        prevAmt,
        daily.map((x) => x.amount),
      ),
      mixByKind: {
        cow: daily.reduce((a, r) => a + r.Cow, 0),
        buffalo: daily.reduce((a, r) => a + r.Buffalo, 0),
        mix: daily.reduce((a, r) => a + r.Mix, 0),
      },
    };
    const totalLit = c.reduce((a, r) => a + r.litres, 0);
    const centreGroups = new Map<string, typeof c>();
    for (const r of c) {
      const id = r.stationId;
      centreGroups.set(id, [...(centreGroups.get(id) ?? []), r]);
    }
    const centres: CentreRow[] = [...centreGroups]
      .map(([id, rs]) => {
        const litres = rs.reduce((a, r) => a + r.litres, 0);
        const last = rs.reduce((a, r) => (r.date > a ? r.date : a), "");
        const status: CentreRow["status"] =
          last === date
            ? "active"
            : last >= plusDays(date, -2)
              ? "slow"
              : "offline";
        return {
          id,
          name: rs[0]?.centre || id,
          litres,
          farmers: new Set(rs.map((r) => r.farmerId)).size,
          fat: weighted(rs, "fat"),
          snf: weighted(rs, "snf"),
          share: totalLit ? (litres / totalLit) * 100 : 0,
          status,
        };
      })
      .sort((a, b) => b.litres - a.litres);
    const supplierGroups = new Map<string, typeof c>();
    for (const r of c) {
      const id = `${r.stationId}|${r.farmerId}`;
      supplierGroups.set(id, [...(supplierGroups.get(id) ?? []), r]);
    }
    const suppliers: SupplierRow[] = [...supplierGroups]
      .map(([key, rs]) => {
        const litres = rs.reduce((a, r) => a + r.litres, 0);
        const types = new Map<string, number>();
        rs.forEach((r) =>
          types.set(r.kind, (types.get(r.kind) ?? 0) + r.litres),
        );
        const kind = ([...types].sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "mix") as SupplierRow["kind"];
        return {
          id: rs[0]?.farmerId || key,
          name: rs[0]?.farmer || key,
          centre: rs[0]?.centre || rs[0]?.stationId || "",
          kind,
          litres,
          fat: weighted(rs, "fat"),
        };
      })
      .sort((a, b) => b.litres - a.litres)
      .slice(0, 10);
    const shiftRows = curRows.filter((r) => r.shift === shift);
    const recentRows = [...shiftRows]
      .sort((a, b) =>
        `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
      )
      .slice(0, 25);
    const todayRows = shiftRows;
    const todayLitres = todayRows.reduce((a, r) => a + r.litres, 0);
    const todayFarmers = new Set(
      todayRows.map((r) => `${r.stationId}:${r.farmerId}`),
    ).size;
    const todayGroups = new Map<string, typeof todayRows>();
    for (const r of todayRows) {
      todayGroups.set(r.stationId, [
        ...(todayGroups.get(r.stationId) ?? []),
        r,
      ]);
    }
    const todayCentres: TodayCentre[] = [...todayGroups]
      .map(([id, rs]) => ({
        id,
        name: rs[0]?.centre || id,
        litres: rs.reduce((a, r) => a + r.litres, 0),
        fat: weighted(rs, "fat"),
        snf: weighted(rs, "snf"),
        amount: rs.reduce((a, r) => a + r.amount, 0),
        farmers: new Set(rs.map((r) => r.farmerId)).size,
      }))
      .sort((a, b) => b.litres - a.litres);
    const dataReady = !current.loading;
    return {
      summary,
      todayCentres,
      todayDate: date,
      trend: daily.map((r) => ({
        label: shortDate(r.date),
        Cow: r.Cow,
        Buffalo: r.Buffalo,
        Mix: r.Mix,
        Fat: r.Fat,
        SNF: r.SNF,
      })),

      shifts: bothShifts.map((r) => ({
        label: shortDate(r.date),
        Morning: r.Morning,
        Evening: r.Evening,
      })),
      centres,
      suppliers,
      recentRows,
      today: {
        litres: todayLitres,
        target: 0,
        percent: 0,
        remaining: 0,
        shift,
        shiftState: dataReady
          ? todayRows.length
            ? "Actual portal data loaded"
            : "No records returned for this shift"
          : "Loading portal data",
        farmersPoured: todayFarmers,
      },
      loading: current.loading || previous.loading,
      error: current.error || previous.error,
    };
  }, [
    current.rows,
    current.loading,
    current.error,
    previous.rows,
    previous.loading,
    previous.error,
    date,
    shift,
    prevDate,
    centre,
  ]);
}