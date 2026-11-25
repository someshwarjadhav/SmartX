import { dpuReadAttempts, type SaveAttempt } from "../http/dpu";
import { clearRequestMemo } from "../http/client";
import { ApiError, EmptyReplyError } from "../http/errors";
import { isObj, norm, type Obj } from "../utils/loose";
import { encryptPayload } from "../../lib/portal/crypto";

/**
 * VLC milk bill from the DPU API (POST, Bearer token, encrypted reply):
 *   POST https://dpu.shivinfotech.co.in/api/Login/GetStationWiseMilkBill
 *
 * The decrypted reply looks like
 *   { "stationid:7010101 : Office Use : 2026-10-01 To 2026-10-10":
 *       { cowMilk: [...], buffaloMilk: [...], mixMilk: [...] } }
 * where every row is ONE DAY with a morning (m*) and an evening (e*) part:
 *   dtdate, mweight, mfat, msnf, mclr, MRate, mtotal_amount, mshift, mmilk_type,
 *   eweight, efat, esnf, eclr, ERate, etotal_amount, eshift, Milktype
 *
 */
export const VLC_MILK_BILL_PATH = "/Login/GetStationWiseMilkBill";

export interface VlcMilkBillQuery {
  /** yyyy-mm-dd */
  fromdate: string;
  /** yyyy-mm-dd */
  todate: string;
  /** Every VLC / centre id the signed-in user can see. */
  stationIds: string[];
}

export type MilkKind = "cow" | "buffalo" | "mix";

/** One shift (morning or evening) of one day, or the total of a whole list. */
export interface ShiftData {
  wt: number;
  fat: number;
  snf: number;
  clr: number;
  rate: number;
  amt: number;
}

export interface BillDay {
  /** dd/MM/yyyy exactly as the API sends it */
  date: string;
  m: ShiftData | null;
  e: ShiftData | null;
}

export interface BillSection {
  kind: MilkKind;
  label: string;
  days: BillDay[];
  mTotal: ShiftData;
  eTotal: ShiftData;
}

export interface VlcBill {
  stationId: string;
  stationName: string;
  /** dd-MM-yyyy */
  from: string;
  to: string;
  sections: BillSection[];
}

export interface VlcMilkBillResult {
  bills: VlcBill[];
  /** Centres whose call failed while others worked. */
  failed: number;
}

const NO_RECORD = /no\s*(record|data)/i;

const SECTIONS: Array<{ key: string; kind: MilkKind; label: string }> = [
  { key: "cowmilk", kind: "cow", label: "Cow Milk" },
  { key: "buffalomilk", kind: "buffalo", label: "Buffalo Milk" },
  { key: "mixmilk", kind: "mix", label: "Mix Milk" },
];

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};

/** Reads a field whatever the letter case is (MRate / mrate, ERate / erate ...). */
const field = (row: Obj, name: string): unknown => {
  const want = norm(name);
  for (const k of Object.keys(row)) if (norm(k) === want) return row[k];
  return undefined;
};

/** An empty shift comes as weight 0 with a null shift flag - it is left blank on the bill. */
function shiftOf(row: Obj, p: "m" | "e"): ShiftData | null {
  const wt = n(field(row, `${p}weight`));
  const amt = n(field(row, `${p}total_amount`));
  if (wt === 0 && amt === 0) return null;
  return {
    wt,
    fat: n(field(row, `${p}fat`)),
    snf: n(field(row, `${p}snf`)),
    clr: n(field(row, `${p}clr`)),
    rate: n(field(row, p === "m" ? "MRate" : "ERate")),
    amt,
  };
}

/** Weighted average of fat / snf / clr, rate = amount / weight of the rows that have an amount. */
export function totalOf(list: Array<ShiftData | null>): ShiftData {
  const t: ShiftData = { wt: 0, fat: 0, snf: 0, clr: 0, rate: 0, amt: 0 };
  let fat = 0;
  let snf = 0;
  let clr = 0;
  let ratedWt = 0;
  for (const s of list) {
    if (!s) continue;
    t.wt += s.wt;
    t.amt += s.amt;
    fat += s.fat * s.wt;
    snf += s.snf * s.wt;
    clr += s.clr * s.wt;
    if (s.amt > 0) ratedWt += s.wt;
  }
  if (t.wt > 0) {
    t.fat = fat / t.wt;
    t.snf = snf / t.wt;
    t.clr = clr / t.wt;
  }
  if (ratedWt > 0) t.rate = t.amt / ratedWt;
  return t;
}

const dayKey = (d: string): string => {
  const [dd, mm, yy] = d.split("/");
  return `${yy ?? ""}${mm ?? ""}${dd ?? ""}`;
};

function sectionOf(row: unknown[], kind: MilkKind, label: string): BillSection | null {
  const days: BillDay[] = row
    .filter(isObj)
    .map((r) => ({
      date: String(field(r, "dtdate") ?? "").trim(),
      m: shiftOf(r, "m"),
      e: shiftOf(r, "e"),
    }))
    .filter((d) => d.m || d.e)
    .sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)));
  if (days.length === 0) return null;
  return {
    kind,
    label,
    days,
    mTotal: totalOf(days.map((d) => d.m)),
    eTotal: totalOf(days.map((d) => d.e)),
  };
}

const iso2dmy = (s: string) => s.split("-").reverse().join("-");

/** "stationid:7010101 : Office Use : 2026-10-01 To 2026-10-10" */
const TITLE = /stationid\s*:\s*([^:]+?)\s*:\s*(.*?)\s*:\s*(\S+)\s+to\s+(\S+)\s*$/i;

function billFrom(title: string, body: Obj, q: VlcMilkBillQuery, stationId: string): VlcBill | null {
  const sections: BillSection[] = [];
  for (const s of SECTIONS) {
    const key = Object.keys(body).find((k) => norm(k) === s.key);
    const list = key ? body[key] : undefined;
    if (!Array.isArray(list)) continue;
    const sec = sectionOf(list, s.kind, s.label);
    if (sec) sections.push(sec);
  }
  if (sections.length === 0) return null;
  const t = TITLE.exec(title);
  return {
    stationId: t?.[1]?.trim() || stationId,
    stationName: t?.[2]?.trim() || "",
    from: t?.[3] ? iso2dmy(t[3]) : iso2dmy(q.fromdate),
    to: t?.[4] ? iso2dmy(t[4]) : iso2dmy(q.todate),
    sections,
  };
}

const hasMilkLists = (o: Obj) =>
  Object.keys(o).some((k) => SECTIONS.some((s) => s.key === norm(k)));

/** Turns the decrypted reply into bills (exported so it can be tested without the network). */
export function parseVlcMilkBill(reply: unknown, q: VlcMilkBillQuery, stationId: string): VlcBill[] {
  return readReply(reply, q, stationId);
}

function readReply(reply: unknown, q: VlcMilkBillQuery, stationId: string, depth = 0): VlcBill[] {
  if (depth > 4) return [];
  let v = reply;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "null") return [];
    if (!/^[[{]/.test(t)) {
      if (NO_RECORD.test(t)) return [];
      throw new ApiError(t, "server");
    }
    try {
      v = JSON.parse(t);
    } catch {
      throw new ApiError("The milk bill reply could not be read.", "parse");
    }
  }
  if (Array.isArray(v)) return v.flatMap((x) => readReply(x, q, stationId, depth + 1));
  if (!isObj(v)) return [];

  const ok = v.Success ?? v.success;
  if (ok === false) {
    const message = String(v.Message ?? v.message ?? "").trim();
    if (!message || NO_RECORD.test(message)) return [];
    throw new ApiError(message, "server");
  }

  // { "<title>": { cowMilk, buffaloMilk, mixMilk } } - the normal reply
  const out: VlcBill[] = [];
  for (const [title, body] of Object.entries(v)) {
    if (isObj(body) && hasMilkLists(body)) {
      const b = billFrom(title, body, q, stationId);
      if (b) out.push(b);
    }
  }
  if (out.length > 0) return out;

  // { cowMilk, buffaloMilk, mixMilk } without the title key
  if (hasMilkLists(v)) {
    const b = billFrom("", v, q, stationId);
    return b ? [b] : [];
  }

  // wrapped as { Data / Message / Result: ... }
  for (const k of ["Data", "data", "Message", "message", "Result", "result", "response"]) {
    if (k in v) {
      const got = readReply(v[k], q, stationId, depth + 1);
      if (got.length > 0) return got;
    }
  }
  return [];
}

/**
 * The server wants { "Payload": "<AES cipher:iv>" } and, inside it, a StationWiseMilkBillRequest with
 * StationIds (all centres in ONE call) and the dates. The server's own messages told us this:
 *   plain JSON -> "The Payload field is required", XOR -> "Invalid encrypted payload", no StationIds -> "StationIds required!".
 * The exact type of StationIds / the date names is not visible from outside, so a few shapes are tried
 * (the one that works is remembered by dpuReadAttempts).
 */
function layouts(q: VlcMilkBillQuery): SaveAttempt[] {
  const ids = q.stationIds;
  const idShapes: Array<[string, unknown]> = [
    ["ids-array", ids],
    ["ids-csv", ids.join(",")],
    ["ids-number-array", ids.map((x) => (Number.isFinite(Number(x)) ? Number(x) : x))],
  ];
  const dateShapes: Array<[string, Obj]> = [
    ["Pascal", { FromDate: q.fromdate, ToDate: q.todate }],
    ["lower", { fromdate: q.fromdate, todate: q.todate }],
  ];
  const attempts: SaveAttempt[] = [];
  for (const [idLabel, StationIds] of idShapes)
    for (const [dateLabel, dates] of dateShapes)
      attempts.push({
        label: `aes-${idLabel}-${dateLabel}`,
        path: VLC_MILK_BILL_PATH,
        body: { Payload: encryptPayload({ StationIds, ...dates }) },
      });
  return attempts;
}

export async function getVlcMilkBill(q: VlcMilkBillQuery): Promise<VlcMilkBillResult> {
  clearRequestMemo();
  const out: VlcMilkBillResult = { bills: [], failed: 0 };
  if (q.stationIds.length === 0) return out;
  try {
    out.bills = await dpuReadAttempts(
      "VlcMilkBill",
      layouts(q),
      (reply) => readReply(reply, q, q.stationIds[0] ?? ""),
    );
  } catch (e) {
    // an empty reply simply means "no record"
    if (e instanceof EmptyReplyError || (e instanceof ApiError && /empty reply/i.test(e.message))) return out;
    throw e;
  }
  out.bills.sort((a, b) => a.stationId.localeCompare(b.stationId, undefined, { numeric: true }));
  return out;
}