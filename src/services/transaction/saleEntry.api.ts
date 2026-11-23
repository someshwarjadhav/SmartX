import { clearRequestMemo } from "../http/client";
import { getSession } from "../session";
import { ApiError, EmptyReplyError } from "../http/errors";
import { GLOBALS } from "../../lib/portal/global";
import { dpuSave, dpuWrite } from "../http/dpu";
import { encryptXorPayload } from "../../lib/portal/crypto";
import { apiDate } from "../utils/date";
import { isObj, norm, type Obj } from "../utils/loose";
import { checkReply } from "../master/farmerMaster.api";
import { readPath } from "../account/voucher.http";
import { DPU } from "../http/dpuEndpoints";

export const VENDOR_PATH = "/dairy/dairy/VenderMasterDN/";
export const ITEM_PATH = "/dairy/dairy/getItemMaster";
export const STOCK_PATH = "/dairy/dairy/itemstock";
export const SALES_PATH = "/dairy/dairy/salespurchase";

export const CATTLE_FEED_BRANCH = "5001";

export type SaleCategory = "S" | "P";
export const CATEGORIES: Array<{ value: SaleCategory; label: string }> = [
  { value: "S", label: "Sale" },
  { value: "P", label: "Purchase" },
];

export const TYPES: Array<{ value: string; label: string }> = [
  { value: "F", label: "Farmer Sale" },
  { value: "V", label: "VLC Sale" },
];
export const typesFor = (
  category: SaleCategory,
): Array<{ value: string; label: string }> =>
  category === "P" ? TYPES : TYPES.filter((t) => t.value === "F");

export const SALE_FLAG = "SA";
export const PURCHASE_FLAG = "PU";
export const wireFlag = (c: SaleCategory): string =>
  c === "P" ? PURCHASE_FLAG : SALE_FLAG;

export const stationOf = (vlcid: string): string =>
  getSession()?.stationByVlcc?.[vlcid] || vlcid;

export interface Option {
  id: string;
  label: string;
}
export interface ItemOption extends Option {
  rate: string;
}

export interface SaleRow {
  key: string;
  id: string;
  date: string;
  stationId: string;
  farmerId: string;
  farmerName: string;
  item: string;
  qty: string;
  rate: string;
  amount: string;
  flag: string;
  raw: Obj;
}

const q = encodeURIComponent;

export const plantIdOf = (): string => String(GLOBALS.plantid || "1").trim();

const txt = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim();

function pick(r: Obj, wanted: string[]): string {
  const keys = Object.keys(r);
  for (const w of wanted) {
    const k = keys.find((x) => norm(x) === w);
    if (k === undefined) continue;
    const v = txt(r[k]);
    if (v) return v;
  }
  return "";
}

const LISTY = [
  "data",
  "message",
  "result",
  "results",
  "table",
  "rows",
  "items",
  "list",
  "response",
];

export function rowsOf(json: unknown, depth = 0): Obj[] {
  if (depth > 5 || json === null || json === undefined) return [];
  if (typeof json === "string") {
    const t = json.trim();
    if (!/^[[{]/.test(t)) return [];
    try {
      return rowsOf(JSON.parse(t), depth + 1);
    } catch {
      return [];
    }
  }
  if (Array.isArray(json)) return json.filter(isObj);
  if (isObj(json)) {
    for (const k of Object.keys(json)) {
      if (!LISTY.includes(norm(k))) continue;
      const got = rowsOf(json[k], depth + 1);
      if (got.length) return got;
    }
  }
  return [];
}

function assertOk(reply: unknown, what: string) {
  if (!isObj(reply)) return;
  const ok = reply.Success ?? reply.success;
  const msg = txt(reply.Message ?? reply.message);
  if (
    (ok === false || String(ok).toLowerCase() === "false") &&
    !/no\s*(record|data)/i.test(msg)
  )
    throw new ApiError(msg || `${what} failed.`, "server");
}

async function read(what: string, path: string): Promise<unknown> {
  const reply = await readPath(path);
  assertOk(reply, what);
  return reply;
}

const itemNames = new Map<string, string>();

export async function getItems(plantId: string): Promise<ItemOption[]> {
  const rows = rowsOf(
    await read("items", `${ITEM_PATH}?plantid=${q(plantId)}`),
  );
  const out = rows
    .map((r) => {
      const id = pick(r, ["itemid", "itemcode", "id", "code"]);
      const name = pick(r, ["itemname", "name", "item", "description"]);
      return {
        id,
        label: name || id,
        rate: pick(r, [
          "salerate",
          "sellingrate",
          "salesrate",
          "rate",
          "price",
          "mrp",
        ]),
      };
    })
    .filter((o) => o.id);
  itemNames.clear();
  for (const o of out) itemNames.set(o.id, o.label);
  return out;
}

export async function getVendors(vlcid: string): Promise<Option[]> {
  const rows = rowsOf(await read("vendors", `${VENDOR_PATH}?id=${q(vlcid)}`));
  const out = rows
    .map((r) => {
      const id = pick(r, [
        "vendorid",
        "venderid",
        "vendorcode",
        "vendercode",
        "id",
        "code",
      ]);
      const name = pick(r, ["vendorname", "vendername", "name"]);
      return { id, label: name ? `${id} | ${name}` : id };
    })
    .filter((o) => o.id);
  return out;
}

function stockFromReply(reply: unknown, itemId: string): string {
  let rows = rowsOf(reply);
  if (!rows.length && isObj(reply)) rows = [reply];
  const label = (itemNames.get(itemId) ?? "").toLowerCase();
  const mine =
    rows.find((r) => pick(r, ["itemid", "itemcode", "id"]) === itemId) ??
    (label
      ? rows.find(
          (r) =>
            pick(r, [
              "itemname",
              "item",
              "name",
              "description",
            ]).toLowerCase() === label,
        )
      : undefined) ??
    (rows.length === 1 && !pick(rows[0]!, ["itemid", "itemcode"])
      ? rows[0]
      : undefined);
  if (!mine) return "";
  return pick(mine, [
    "curstock",
    "currentstock",
    "stock",
    "stockqty",
    "closingstock",
    "closingqty",
    "balance",
    "balqty",
    "closing",
    "availablestock",
    "qtyinhand",
    "qty",
  ]);
}

let stockWinner = "";

export async function getStock(
  plantId: string,
  itemId: string,
  fromIso: string,
  toIso: string,
  vlcid: string = "",
): Promise<string> {
  const station = vlcid ? stationOf(vlcid) : plantId;
  const year = Number(toIso.slice(0, 4));
  const month = Number(toIso.slice(5, 7));
  const fyStart = `${month >= 4 ? year : year - 1}-04-01`;
  const froms: Array<[string, string]> = [
    ["fy-start", fyStart],
    ["jan-1", `${year}-01-01`],
    ["2000", "2000-01-01"],
    ["same-day", fromIso],
  ];
  const pairs: Array<[string, string]> = [
    [plantId, plantId],
    [CATTLE_FEED_BRANCH, CATTLE_FEED_BRANCH],
    [CATTLE_FEED_BRANCH, plantId],
    [station, plantId],
    [station, CATTLE_FEED_BRANCH],
  ];
  const combos: Array<{ key: string; path: string }> = [];
  const seen = new Set<string>();
  for (const [fname, from] of froms)
    for (const [vlcc, plant] of pairs) {
      const key = `${fname}|vlccid=${vlcc}|plantid=${plant}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combos.push({
        key,
        path:
          `${STOCK_PATH}?vlccid=${q(vlcc)}&fromdate=${q(apiDate(from))}` +
          `&todate=${q(apiDate(toIso))}&plantid=${q(plant)}`,
      });
    }
  const ordered = [
    ...combos.filter((c) => c.key === stockWinner),
    ...(stockWinner ? [] : combos),
  ];

  let firstValue = "";
  for (const c of ordered) {
    try {
      const reply = await read("stock", c.path);
      const value = stockFromReply(reply, itemId);
      if (value !== "" && !firstValue) firstValue = value;
      if (parseFloat(value) > 0) {
        stockWinner = c.key;
        return value;
      }
    } catch {
      /* try the next parameter set */
    }
  }
  if (stockWinner) stockWinner = ""; // it no longer gives a positive value
  return firstValue;
}

export const SALE_GET_PATH = DPU.getSalesPurchase;
export const SALE_SAVE_PATH = DPU.salePurchaseSave;
export const SALE_DELETE_PATH = DPU.deleteSalesPurchase;

const authHeaders = (): Record<string, string> => {
  const token = getSession()?.token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/** The request body: { payload: XOR+base64(value) }. */
const sealed = (value: unknown): string =>
  JSON.stringify({ payload: encryptXorPayload(value) });

/** POST an encrypted body and return the decrypted reply. */
const dpuSales = (path: string, value: unknown): Promise<unknown> =>
  dpuWrite(
    path,
    { method: "POST", headers: authHeaders(), body: sealed(value) },
    1,
  );

export interface SaleQuery {
  vlcid: string;
  date: string; // yyyy-mm-dd
  flag: SaleCategory;
  plantId: string;
}

function toRow(r: Obj, i: number): SaleRow {
  const id = pick(r, [
    "autorownum",
    "id",
    "salesid",
    "salespurchaseid",
    "maxid",
    "transid",
    "apptransid",
  ]);
  return {
    key: id || `row${i}`,
    id,
    date: pick(r, ["entrydate", "date", "saledate", "trdate"]),
    stationId: pick(r, ["stationid", "vlccid", "villageid"]),
    farmerId: pick(r, ["farmerid", "farmermastercode", "vendorid", "codeno"]),
    farmerName: pick(r, ["farmername", "vendorname", "name"]),
    item: pick(r, ["itemname", "item", "itemid"]),
    qty: pick(r, ["qty", "quantity"]),
    rate: pick(r, ["rate"]),
    amount: pick(r, ["amount", "totalamount"]),
    flag: pick(r, ["salesflag", "flag"]),
    raw: r,
  };
}

function uniqueRows(list: SaleRow[]): SaleRow[] {
  const seen = new Set<string>();
  const out: SaleRow[] = [];
  for (const r of list) {
    if (r.id) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
    }
    const itemId = pick(r.raw, ["itemid"]);
    const name = itemId ? itemNames.get(itemId) : undefined;
    out.push(name ? { ...r, item: name } : r);
  }
  return out;
}

// ---------------------------------------------------------------------------
// LIST (GetSalesPurchase) -- body shape given by the backend:
//   { "Type": "Plant", "PlantId": "1", "EntryDate": "2026-11-22", "SalesFlag": "SA" }
// The layout the server accepts is remembered.
// ---------------------------------------------------------------------------
const plantQuery = (p: SaleQuery) => ({
  Type: "Plant",
  PlantId: p.plantId,
  EntryDate: apiDate(p.date),
  SalesFlag: wireFlag(p.flag),
});

const LIST_LAYOUTS: Array<{ name: string; build: (p: SaleQuery) => unknown }> =
  [
    { name: "xor-plant", build: (p) => plantQuery(p) },
    { name: "xor-plant-array", build: (p) => [plantQuery(p)] },
  ];

let goodShape = "";

export async function getSales(p: SaleQuery): Promise<SaleRow[]> {
  const layouts = [
    ...LIST_LAYOUTS.filter((x) => x.name === goodShape),
    ...LIST_LAYOUTS.filter((x) => x.name !== goodShape),
  ];
  let firstError: unknown = null;
  let onlyServerErrors = true;
  for (const layout of layouts) {
    try {
      const reply = await dpuSales(SALE_GET_PATH, layout.build(p));
      assertOk(reply, "list");
      const rows = uniqueRows(rowsOf(reply).map(toRow));
      if (rows.length || goodShape === layout.name) {
        goodShape = layout.name;
        return rows;
      }
      if (layout === layouts[layouts.length - 1]) return rows;
    } catch (e) {
      // An empty reply body means "no entries for this day".
      if (e instanceof EmptyReplyError) {
        goodShape = layout.name;
        return [];
      }
      firstError ??= e;
      if (!(e instanceof ApiError && e.kind === "server"))
        onlyServerErrors = false;
      if (e instanceof ApiError && e.kind === "auth") throw e;
    }
  }
  // The server answers with an error when it has nothing to list for the day:
  // show an empty table, not an error.
  if (onlyServerErrors) return [];
  throw firstError;
}

export interface SaleInput {
  vlcid: string;
  category: SaleCategory;
  farmerId: string;
  date: string;
  itemId: string;
  qty: number;
  rate: number;
  paid: number;
  plantId: string;
}

const money = (n: number) => Math.round(n * 100) / 100;
const two = (n: number) => money(n).toFixed(2);
const idValue = (v: string): string | number =>
  /^\d+$/.test(v) ? Number(v) : v;

// The record exactly as mam sent it on WhatsApp (key order, text/number types included):
// farmerId + farmerMasterCode are NUMBERS, every other value is TEXT, Qty has no forced
// decimals ("6"), Rate and Amount have 2 decimals ("6.00", "36.00").
export function saleRecord(s: SaleInput) {
  return {
    farmerId: idValue(s.farmerId),
    farmerMasterCode: idValue(s.farmerId),
    EntryDate: apiDate(s.date),
    ItemId: String(s.itemId),
    Qty: String(money(s.qty)),
    Rate: two(s.rate),
    Amount: two(s.qty * s.rate),
    PaidAmount: String(s.paid),
    SalesFlag: wireFlag(s.category),
    BranchId: CATTLE_FEED_BRANCH,
    AppTransID: "0",
    lastsyncdate: apiDate(new Date().toISOString().slice(0, 10)),
    StationId: stationOf(s.vlcid),
    PlantId: s.plantId,
  };
}

let saveWinner = "";

export async function saveSale(s: SaleInput): Promise<string> {
  const fields = saleRecord(s);
  // Same record with every value as text, used only if the server says a number/text type is wrong.
  const allText = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, String(v)]),
  );

  // IMPORTANT: a save is sent ONCE. A second layout is tried ONLY when the server clearly
  // refuses the request FORMAT (400 / 415 / 422 / "could not be converted" ...), which means
  // nothing was stored. A 500, a timeout or a network error is never retried, because the
  // server may already have stored the entry (that is what created duplicate rows before).
  const layouts: Array<{ name: string; value: unknown }> = [
    { name: "xor-array", value: [fields] },
    { name: "xor-object", value: fields },
    { name: "xor-array-all-text", value: [allText] },
  ];
  const ordered = [
    ...layouts.filter((l) => l.name === saveWinner),
    ...layouts.filter((l) => l.name !== saveWinner),
  ];
  const FORMAT_REFUSED =
    /error (400|415|422)\b|could not be converted|json value|base-?64|payload|is required|unsupported media|not a valid|unexpected character|deserializ/i;

  let message = "";
  let lastError: unknown = null;
  for (const l of ordered) {
    try {
      message = await dpuSave(
        SALE_SAVE_PATH,
        sealed(l.value),
        "POST",
        authHeaders(),
      );
      saveWinner = l.name;
      lastError = null;
      break;
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      lastError = e;
      const formatRefused =
        e instanceof ApiError &&
        e.kind === "server" &&
        FORMAT_REFUSED.test(why);
      if (!formatRefused) throw e;
    }
  }
  if (lastError) throw lastError;
  clearRequestMemo();
  return message || "Record saved";
}

// Delete one Cattle Feed entry: POST /Login/DeleteSalesPurchase with the row inside the
// encrypted payload. Layouts are tried in order and the accepted one is remembered.
let deleteWinner = "";

export async function deleteSale(row: SaleRow, p: SaleQuery): Promise<string> {
  void p;
  // Shape given by mam (WhatsApp):  { "AutoRowNum": 123 }  (a number)
  const num = /^\d+$/.test(row.id) ? Number(row.id) : row.id;
  const one = { AutoRowNum: num };
  const attempts: Array<{ name: string; value: unknown }> = [
    { name: "xor-object", value: one },
    { name: "xor-array", value: [one] },
  ];
  const ordered = [
    ...attempts.filter((a) => a.name === deleteWinner),
    ...attempts.filter((a) => a.name !== deleteWinner),
  ];

  let text = "";
  let lastError: unknown = null;
  for (const a of ordered) {
    try {
      const reply = await dpuSales(SALE_DELETE_PATH, a.value);
      text = typeof reply === "string" ? reply : JSON.stringify(reply);
      checkReply(text, "The entry could not be deleted.", true);
      deleteWinner = a.name;
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      if (e instanceof ApiError && e.kind === "auth") throw e;
    }
  }
  if (lastError) throw lastError;
  clearRequestMemo();
  return checkReply(text, "The entry could not be deleted.", true) || "Deleted";
}