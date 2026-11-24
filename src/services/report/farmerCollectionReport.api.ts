import { FARMER_MILK_CODES } from "../config";
import {
  clearRequestMemo,
  gatewayPost,
  gatewayPostJson,
  listOf,
} from "../http/client";
import { ApiError, isEmptyReply } from "../http/errors";
import { getSession } from "../session";
import { apiDate } from "../utils/date";
import { todayIso } from "../http/chunkCache";

export const FARMER_COLLECTION_REPORT_PATH = "/home/farmercollectionreport";
export const FARMER_COLLECTION_REPORT_ALL_PATH =
  "/home/FarmerCollectionReportNew";

export type ReportMilk = "cow" | "buffalo" | "mix" | "both";

export interface CollectionReportRow {
  id: string;
  dcsCode: string;
  dcsName: string;
  /** yyyy-MM-dd */
  date: string;
  memberCode: string;
  memberName: string;
  milkType: string;
  morningQty: number;
  morningLr: number;
  morningFat: number;
  morningSnf: number;
  morningRate: number;
  eveningQty: number;
  eveningLr: number;
  eveningFat: number;
  eveningSnf: number;
  eveningRate: number;
}

export interface CollectionReportQuery {
  milk: ReportMilk;
  /** yyyy-MM-dd */
  from: string;
  to: string;
  /** every VLC (station) asked for. One id = getData, more than one = getAllUnionData */
  stationIds: string[];
  /** true when the VLC dropdown is on "All" */
  allCentres: boolean;
  /** MCC id sent as `mccid` */
  mccId: string;
  /** progress for the loader (done of total requests) */
  onProgress?: (done: number, total: number) => void;
  /** true = ask the server again even if the same answer is remembered (Retry / Submit again with the same filters) */
  force?: boolean;
}

const MILK_CODE: Record<Exclude<ReportMilk, "both">, string> = {
  cow: "C",
  buffalo: "B",
  mix: "M",
};

const milkCodes = (milk: ReportMilk): string[] =>
  milk === "both"
    ? FARMER_MILK_CODES.length
      ? FARMER_MILK_CODES
      : ["C", "B", "M"]
    : [MILK_CODE[milk]];

/* ---------------- raw -> row ---------------- */

type Raw = Record<string, unknown>;
const nk = (k: string): string => k.toLowerCase().replace(/[^a-z0-9]/g, "");

const lookup = (row: Raw): Map<string, unknown> => {
  const m = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    const key = nk(k);
    if (!m.has(key)) m.set(key, v);
  }
  return m;
};

const has = (v: unknown): boolean =>
  v !== null && v !== undefined && String(v).trim() !== "";

const pickRaw = (m: Map<string, unknown>, names: string[]): unknown => {
  for (const n of names) {
    const v = m.get(n);
    if (has(v)) return v;
  }
  return undefined;
};
const text = (m: Map<string, unknown>, names: string[]): string => {
  const v = pickRaw(m, names);
  return has(v) ? String(v).trim() : "";
};
const num = (m: Map<string, unknown>, names: string[]): number => {
  const v = pickRaw(m, names);
  const n =
    typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** names the server may use for one value of one shift: morningqty, mqty, morning_qty, qtymorning ... */
const SHIFT_PREFIX: Record<"m" | "e", string[]> = {
  m: ["morning", "morn", "mor", "mng", "m"],
  e: ["evening", "even", "eve", "evng", "e"],
};
const FIELD: Record<"qty" | "lr" | "fat" | "snf" | "rate", string[]> = {
  qty: ["qty", "quantity", "liter", "litre", "liters", "litres", "ltr"],
  lr: ["lr", "clr", "degree", "lacto", "lactometer"],
  fat: ["fat"],
  snf: ["snf"],
  rate: ["rate", "rtpl", "ratepl"],
};
const shiftNames = (s: "m" | "e", f: keyof typeof FIELD): string[] =>
  SHIFT_PREFIX[s].flatMap((p) =>
    FIELD[f].flatMap((x) => [`${p}${x}`, `${x}${p}`]),
  );

const DCS_CODE = [
  "dcscode",
  "stationcode",
  "customstationid",
  "centercode",
  "vlccode",
  "stationid",
  "vlccid",
  "villageid",
  "vlcid",
  "dcsid",
  "dcs",
];
const DCS_NAME = [
  "dcsname",
  "vlccname",
  "vlcname",
  "villagename",
  "stationname",
  "centername",
  "centrename",
  "societyname",
];
const DATE = [
  "date",
  "trdate",
  "collectiondate",
  "dtdate",
  "entrydate",
  "tdate",
];
const MEMBER_CODE = [
  "membercode",
  "farmerid",
  "farmercode",
  "memberid",
  "memberno",
  "farmerno",
  "member",
];
const MEMBER_NAME = [
  "membername",
  "farmername",
  "name",
  "fname",
  "member name",
];
const MILK = ["milktype", "milk", "milkcode", "type"];
const SHIFT = ["shift", "shiftname"];
const LONG_QTY = ["qty", "quantity", "liter", "litre", "liters", "litres"];

const MON = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** 2026-11-19T00:00:00 | 19/11/2026 | 19-11-2026 | 19 Nov 2026 -> 2026-11-19 */
export function isoOf(raw: string): string {
  const s = String(raw ?? "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(s);
  if (m) {
    const mi = MON.indexOf(m[2]!.toLowerCase());
    if (mi >= 0)
      return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const milkLabel = (v: string): string => {
  const x = v.trim().toLowerCase();
  if (!x) return "";
  if (x === "c" || x.startsWith("cow")) return "Cow";
  if (x === "b" || x.startsWith("buf")) return "Buffalo";
  if (x === "m" || x.startsWith("mix")) return "Mix";
  return v.trim();
};

const blankRow = (): Omit<CollectionReportRow, "id"> => ({
  dcsCode: "",
  dcsName: "",
  date: "",
  memberCode: "",
  memberName: "",
  milkType: "",
  morningQty: 0,
  morningLr: 0,
  morningFat: 0,
  morningSnf: 0,
  morningRate: 0,
  eveningQty: 0,
  eveningLr: 0,
  eveningFat: 0,
  eveningSnf: 0,
  eveningRate: 0,
});

/**
 * The server sends one row per DCS + date + member + milk with Morning and Evening side by side.
 * If it ever sends one row per shift (Shift + Qty / Fat / SNF ...), the two shifts are joined into one row here.
 */
export function mapCollectionReport(
  rows: Raw[],
  fallbackMilk = "",
): CollectionReportRow[] {
  const out = new Map<string, CollectionReportRow>();
  let seq = 0;
  for (const raw of rows) {
    const m = lookup(raw);
    const base = blankRow();
    base.dcsCode = text(m, DCS_CODE);
    base.dcsName = text(m, DCS_NAME);
    base.date = isoOf(text(m, DATE));
    base.memberCode = text(m, MEMBER_CODE);
    base.memberName = text(m, MEMBER_NAME);
    base.milkType = milkLabel(text(m, MILK)) || fallbackMilk;

    const wide =
      pickRaw(m, shiftNames("m", "qty")) !== undefined ||
      pickRaw(m, shiftNames("e", "qty")) !== undefined ||
      pickRaw(m, shiftNames("m", "fat")) !== undefined ||
      pickRaw(m, shiftNames("e", "fat")) !== undefined;

    if (wide) {
      seq += 1;
      out.set(`w${seq}`, {
        ...base,
        id: `w${seq}`,
        morningQty: num(m, shiftNames("m", "qty")),
        morningLr: num(m, shiftNames("m", "lr")),
        morningFat: num(m, shiftNames("m", "fat")),
        morningSnf: num(m, shiftNames("m", "snf")),
        morningRate: num(m, shiftNames("m", "rate")),
        eveningQty: num(m, shiftNames("e", "qty")),
        eveningLr: num(m, shiftNames("e", "lr")),
        eveningFat: num(m, shiftNames("e", "fat")),
        eveningSnf: num(m, shiftNames("e", "snf")),
        eveningRate: num(m, shiftNames("e", "rate")),
      });
      continue;
    }

    // one row per shift -> join by DCS + date + member + milk
    const shift = text(m, SHIFT).toLowerCase();
    const evening = shift.startsWith("e");
    const key = [base.dcsCode, base.date, base.memberCode, base.milkType].join(
      "|",
    );
    const row = out.get(key) ?? { ...base, id: `l${(seq += 1)}` };
    const qty = num(m, LONG_QTY);
    const lr = num(m, FIELD.lr);
    const fat = num(m, FIELD.fat);
    const snf = num(m, FIELD.snf);
    const rate = num(m, FIELD.rate);
    if (evening) {
      row.eveningQty += qty;
      row.eveningLr = lr;
      row.eveningFat = fat;
      row.eveningSnf = snf;
      row.eveningRate = rate;
    } else {
      row.morningQty += qty;
      row.morningLr = lr;
      row.morningFat = fat;
      row.morningSnf = snf;
      row.morningRate = rate;
    }
    out.set(key, row);
  }
  return [...out.values()].sort(
    (a, b) =>
      a.dcsCode.localeCompare(b.dcsCode, undefined, { numeric: true }) ||
      a.date.localeCompare(b.date) ||
      a.memberCode.localeCompare(b.memberCode, undefined, { numeric: true }) ||
      a.milkType.localeCompare(b.milkType),
  );
}

/* ---------------- API calls ---------------- */

const asRows = (json: unknown): Raw[] => {
  try {
    return listOf<Raw>(json);
  } catch (e) {
    if (isEmptyReply(e)) return [];
    throw e;
  }
};

/** portal: FarmerCollectionReportService.getData(milktype, fromdate, todate, stationid, mccid) */
export async function getData(
  milktype: string,
  fromdate: string,
  todate: string,
  stationid: string,
  mccid: string,
): Promise<Raw[]> {
  try {
    return asRows(
      await gatewayPost(FARMER_COLLECTION_REPORT_PATH, {
        milktype,
        fromdate,
        todate,
        stationid,
        mccid,
      }),
    );
  } catch (e) {
    if (isEmptyReply(e)) return [];
    throw e;
  }
}

/** portal: FarmerCollectionReportService.getAllUnionData({ milktype, fromdate, todate, stationIds }) */
export async function getAllUnionData(
  milktype: string,
  fromdate: string,
  todate: string,
  stationIds: string[],
): Promise<Raw[]> {
  try {
    return asRows(
      await gatewayPostJson(FARMER_COLLECTION_REPORT_ALL_PATH, {
        milktype,
        fromdate,
        todate,
        stationIds: stationIds.map((id) =>
          /^\d+$/.test(id) ? Number(id) : id,
        ),
      }),
    );
  } catch (e) {
    if (isEmptyReply(e)) return [];
    throw e;
  }
}

/* ---------------- remembered answers ----------------
 * One answer per milk type (C / B / M) + dates + centres is kept for a short time, so:
 *   - going from "Both" to "Cow" (or back) does not ask the server again for a milk type that is already loaded
 *   - Submit with the same filters again (or Retry) still asks the server again (force)
 *   - a range that includes today is never remembered: today is still changing
 */
const RECENT_KEEP_MS = 5 * 60_000;
const OLD_KEEP_MS = 6 * 60 * 60_000;
const memory = new Map<string, { at: number; rows: CollectionReportRow[] }>();

const keepMs = (to: string): number => {
  if (to >= todayIso()) return 0;
  const d = new Date();
  d.setDate(d.getDate() - 3);
  const recent = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return to >= recent ? RECENT_KEEP_MS : OLD_KEEP_MS;
};

const memoryKey = (
  code: string,
  q: CollectionReportQuery,
  ids: string[],
  mccId: string,
): string =>
  `${getSession()?.scope ?? ""}|${code}|${q.from}|${q.to}|${q.allCentres ? "all" : "one"}|${mccId}|${ids.join(",")}`;

const fromMemory = (key: string, to: string): CollectionReportRow[] | null => {
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > keepMs(to)) {
    memory.delete(key);
    return null;
  }
  return hit.rows;
};

const toMemory = (
  key: string,
  to: string,
  rows: CollectionReportRow[],
): void => {
  if (keepMs(to) <= 0) return;
  memory.set(key, { at: Date.now(), rows });
  while (memory.size > 60) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
};

const numbered = (rows: CollectionReportRow[]): CollectionReportRow[] =>
  rows.map((r, i) => ({ ...r, id: `${r.id}-${i}` }));

/**
 * The rows at once (no request) when every milk type of this query is already remembered, else null.
 * The page uses it so changing the milk type after Submit shows the table without any loader.
 */
export function peekFarmerCollectionReport(
  q: CollectionReportQuery,
): CollectionReportRow[] | null {
  const ids = q.stationIds.filter(Boolean);
  if (!ids.length) return null;
  const mccId = q.mccId || getSession()?.mccId || "";
  const all: CollectionReportRow[] = [];
  for (const code of milkCodes(q.milk)) {
    const rows = fromMemory(memoryKey(code, q, ids, mccId), q.to);
    if (!rows) return null;
    all.push(...rows);
  }
  return numbered(all);
}

export async function fetchFarmerCollectionReport(
  q: CollectionReportQuery,
): Promise<CollectionReportRow[]> {
  const from = apiDate(q.from);
  const to = apiDate(q.to);
  const mccId = q.mccId || getSession()?.mccId || "";
  const codes = milkCodes(q.milk);
  const ids = q.stationIds.filter(Boolean);
  if (!ids.length) return [];

  const label = (code: string): string =>
    code === "C" ? "Cow" : code === "B" ? "Buffalo" : code === "M" ? "Mix" : "";

  // milk types that are already remembered are not asked again (unless the person pressed Submit again with the same filters)
  const have = new Map<string, CollectionReportRow[]>();
  if (!q.force) {
    for (const code of codes) {
      const hit = fromMemory(memoryKey(code, q, ids, mccId), q.to);
      if (hit) have.set(code, hit);
    }
  }
  const todo = codes.filter((c) => !have.has(c));
  if (todo.length) clearRequestMemo(); // asking the server: do not reuse an older request

  let done = 0;
  let total = todo.length;
  const tick = () => q.onProgress?.(++done, total);
  q.onProgress?.(0, total);

  // every milk type is asked at the same time (before: Cow, then Buffalo, then Mix one after the other)
  const loadCode = async (code: string): Promise<CollectionReportRow[]> => {
    let complete = true;
    let rows: CollectionReportRow[];
    // one VLC -> getData
    if (!q.allCentres && ids.length === 1) {
      rows = mapCollectionReport(
        await getData(code, from, to, ids[0]!, mccId),
        label(code),
      );
      tick();
    } else {
      // VLC "All" -> getAllUnionData; when it fails, each VLC is asked one by one with getData
      try {
        rows = mapCollectionReport(
          await getAllUnionData(code, from, to, ids),
          label(code),
        );
        tick();
      } catch (e) {
        if (e instanceof ApiError && e.kind === "auth") throw e;
        total += ids.length - 1;
        let firstError: unknown = null;
        let failed = 0;
        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const got = await getData(code, from, to, id, mccId);
              return mapCollectionReport(got, label(code));
            } catch (err) {
              failed += 1;
              firstError ??= err;
              return [] as CollectionReportRow[];
            } finally {
              tick();
            }
          }),
        );
        if (failed === ids.length && firstError) throw firstError;
        complete = failed === 0;
        rows = results.flat();
      }
    }
    if (complete) toMemory(memoryKey(code, q, ids, mccId), q.to, rows);
    return rows;
  };

  const loaded = new Map<string, CollectionReportRow[]>();
  await Promise.all(
    todo.map(async (code) => {
      loaded.set(code, await loadCode(code));
    }),
  );

  const all: CollectionReportRow[] = [];
  for (const code of codes)
    all.push(...(have.get(code) ?? loaded.get(code) ?? []));
  return numbered(all);
}
