import { useMemo, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import {
  getCenters,
  getMenuTree,
  getReportConfig,
  restoreSession,
  subscribeMenu,
} from "../services/bootstrap";
import { columnOrder, columnVisible } from "../services/report/report.api.ts";
import type { Center } from "../services/mappers/center.mapper.ts";
import type { LoginProfile } from "../services/auth/auth.api.ts";
import type { Column } from "../components/ui/DataTable";
import { COLUMN_ALIASES } from "../config/portal/reportAccess";

export function useLoginData(): LoginProfile | null {
  const { pathname } = useLocation();
  return useMemo(() => restoreSession(), [pathname]);
}

export const useCenters = (): Center[] => getCenters();

export const useMenuTree = () =>
  useSyncExternalStore(subscribeMenu, getMenuTree);

export function useReportColumns(report: string) {
  const cfg = getReportConfig();
  return {
    isVisible: (key: string, aliases: string[] = []) =>
      columnVisible(cfg, report, [key, ...aliases]),
    arrange: <T>(
      items: T[],
      keyOf: (t: T) => string,
      aliases: Record<string, string[]>,
    ): T[] =>
      items
        .filter((t) =>
          columnVisible(cfg, report, [keyOf(t), ...(aliases[keyOf(t)] ?? [])]),
        )
        .map((t, i) => ({
          t,
          i,
          o: columnOrder(cfg, report, [keyOf(t), ...(aliases[keyOf(t)] ?? [])]),
        }))
        .sort((a, b) => (a.o ?? Infinity) - (b.o ?? Infinity) || a.i - b.i)
        .map((x) => x.t),
  };
}

/**
 * Columns of a table report filtered / ordered by the user's report access (userReportConfig),
 * plus helpers that cut the Excel / PDF / CSV arrays the same way. `report` = key of REPORT_INDEX.
 * The export arrays must be in the same order as `columns`.
 */
export function useReportTable<T>(report: string, columns: Column<T>[]) {
  const shown = useReportColumns(report).arrange(columns, (c) => c.key, COLUMN_ALIASES);
  const idx = shown.map((c) => columns.indexOf(c));
  const pick = <A>(arr: A[]): A[] => idx.map((i) => arr[i] as A);
  const pickTotals = (arr: Array<string | number>): Array<string | number> => {
    const out = pick(arr);
    if (out.length && out[0] === "") out[0] = "Total";
    return out;
  };
  return { columns: shown, pick, pickTotals };
}
