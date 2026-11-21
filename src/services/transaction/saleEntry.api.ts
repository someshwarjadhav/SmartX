import { clearRequestMemo, gatewayText } from "../http/client";
import { getSession } from "../session";
import { ApiError } from "../http/errors";
import { GLOBALS } from "../../lib/portal/global";
import { dpuWrite } from "../http/dpu";
import { BASE_URL } from "../config";
import { encryptPayload, encryptXorPayload } from "../../lib/portal/crypto";
import { apiDate } from "../utils/date";
import { isObj, norm, type Obj } from "../utils/loose";
import { checkReply } from "../master/farmerMaster.api";
import { readPath } from "../account/voucher.http";

export const VENDOR_PATH = "/dairy/dairy/VenderMasterDN/";
export const ITEM_PATH = "/dairy/dairy/getItemMaster";
export const STOCK_PATH = "/dairy/dairy/itemstock";
export const SALES_PATH = "/dairy/dairy/salespurchase";

// Cattle feed entries always belong to branch 5001 (static, same as the old
// portal). It is used as BranchId when saving and for the stock lookup.
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

/** Every Cattle Feed log line starts with [SaleEntry] -- filter the Console by that. */
export const log = (...a: unknown[]): void =>
  console.log("[SaleEntry]", ...a);

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

// ItemId -> item name, filled when the item list loads. The list API repeats an
// entry once per item name (same autorownum), so the real name is looked up here.
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
            pick(r, ["itemname", "item", "name", "description"]).toLowerCase() ===
            label,
        )
      : undefined) ??
    (rows.length === 1 && !pick(rows[0]!, ["itemid", "itemcode"])
      ? rows[0]
      : undefined);
  if (!mine) {
    log("stock: no row for item", itemId, "rows:", rows);
    return "";
  }
  const stock = pick(mine, [
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
  if (!stock) log("stock: row found but no stock field in", mine);
  return stock;
}

// The first version sent from = to = the sale date, which only returns the
// movement of that single day (that is why it showed -1 after a sale of 1).
// Real stock needs a wider "from" date, so a few likely parameter sets are
// tried until one gives a positive stock; the winner is remembered.
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
      log("stock try", c.key, "->", value === "" ? "(empty)" : value, c.path);
      if (value !== "" && !firstValue) firstValue = value;
      if (parseFloat(value) > 0) {
        if (stockWinner !== c.key) log("stock: using", c.key);
        stockWinner = c.key;
        return value;
      }
    } catch (e) {
      log("stock try FAILED", c.key, c.path, e);
    }
  }
  if (stockWinner) stockWinner = ""; // it no longer gives a positive value
  log("stock: no positive stock found; showing", firstValue || "(nothing)");
  return firstValue;
}

// ---------------------------------------------------------------------------
// DPU is used for list/delete. Save continues through the legacy SmartX gateway
// because /api/Login/salespurchase returns 500 for the encrypted save request.
//
// DPU POST https://dpu.shivinfotech.co.in/api/Login/salespurchase
//   Authorization: Bearer <token>      Content-Type: application/json
//   body: { "payload": XOR+base64( { "json": "<JSON text of the array>", "id": "<action>" } ) }
//
// action id: 2 = list, 3 = delete. Save uses the SmartX gateway form contract.
// ---------------------------------------------------------------------------
const DPU_SALES = "/Login/salespurchase";

const xorBody = (key: "payload" | "Payload", v: unknown): string =>
  JSON.stringify({ [key]: encryptXorPayload(v) });

const aesBody = (v: unknown): string =>
  JSON.stringify({ Payload: encryptPayload(v) });

async function dpuSales(body: string): Promise<unknown> {
  const token = getSession()?.token;
  return dpuWrite(
    DPU_SALES,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    },
    1,
  );
}

export interface SaleQuery {
  vlcid: string;
  date: string; // yyyy-mm-dd
  flag: SaleCategory;
  plantId: string;
}

const listJson = (p: SaleQuery) =>
  JSON.stringify({
    StationId: stationOf(p.vlcid),
    PlantId: p.plantId,
    SalesFlag: wireFlag(p.flag),
    EntryDate: apiDate(p.date),
    FromDate: apiDate(p.date),
    ToDate: apiDate(p.date),
  });

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

// One saved entry comes back once PER ITEM NAME from the list API (same
// autorownum, same ItemId, only "itemname" differs), so a single save looked
// like 5 saved records. Keep one row per autorownum and take the item name
// from the item master using the row's ItemId.
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

// The old portal sends the list query as an ARRAY with the full entry shape
// (blank values) -- see its Network > Payload for salespurchase&id=2. The first
// version of this page sent a plain object instead, which the server rejects
// with "500 ... view 'Error' not found". Try the old shape first, then the
// object shapes, and remember whichever one the server accepts.
const oldStyleJson = (p: SaleQuery) =>
  JSON.stringify([
    {
      farmerId: "",
      farmerMasterCode: "",
      EntryDate: apiDate(p.date),
      ItemId: "",
      Qty: "",
      Rate: "",
      Amount: "",
      PaidAmount: "",
      SalesFlag: wireFlag(p.flag),
      BranchId: "",
      AppTransID: "0",
      lastsyncdate: "",
      StationId: stationOf(p.vlcid),
      PlantId: p.plantId,
    },
  ]);

const LIST_SHAPES: Array<{ name: string; build: (p: SaleQuery) => string }> = [
  { name: "old-array", build: oldStyleJson },
  { name: "object", build: listJson },
  { name: "object-array", build: (p) => `[${listJson(p)}]` },
];
let goodShape = "";

export async function getSales(p: SaleQuery): Promise<SaleRow[]> {
  const shapes = [
    ...LIST_SHAPES.filter((x) => x.name === goodShape),
    ...LIST_SHAPES.filter((x) => x.name !== goodShape),
  ];
  let firstError: unknown = null;
  let onlyServerErrors = true;
  // 1) DPU, encrypted body { json, id: "2" }. Rows found -> done. An empty or
  //    failed answer falls through to the old layouts below (a read is safe).
  if (goodShape === "" || goodShape === "dpu") {
    try {
      const reply = await dpuSales(
        xorBody("payload", { json: oldStyleJson(p), id: "2" }),
      );
      assertOk(reply, "list");
      const all = rowsOf(reply).map(toRow);
      if (all.length) {
        goodShape = "dpu";
        const rows = uniqueRows(all);
        log(`list ok (dpu): ${all.length} rows from server, ${rows.length} after removing repeats`);
        return rows;
      }
      log("list (dpu): no rows, checking the old layouts too. reply:", reply);
    } catch (e) {
      console.warn("[SaleEntry] list \"dpu\" failed, trying the old layouts:", e);
      if (e instanceof ApiError && e.kind === "auth") throw e;
    }
    goodShape = "";
  }
  for (const shape of shapes) {
    try {
      const reply = await read(
        "list",
        `${SALES_PATH}?json=${q(shape.build(p))}&id=2`,
      );
      goodShape = shape.name;
      const all = rowsOf(reply).map(toRow);
      const rows = uniqueRows(all);
      log(`list ok (${shape.name}): ${all.length} rows from server, ${rows.length} after removing repeats`);
      return rows;
    } catch (e) {
      console.warn(`[SaleEntry] list "${shape.name}" failed:`, e);
      firstError ??= e;
      if (!(e instanceof ApiError && e.kind === "server"))
        onlyServerErrors = false;
      if (e instanceof ApiError && e.kind === "auth") throw e;
    }
  }
  // The server answers 500 when it has nothing to list for the day (the old
  // portal shows "0 of 0" in that case) -- show an empty table, not an error.
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

// The SmartX gateway save form carries json and id as form fields.
const SAVE_ID = "5";

const asUrlEncoded = (json: string) => {
  const form = new URLSearchParams();
  form.append("json", json);
  form.append("id", SAVE_ID);
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  };
};

export async function saveSale(s: SaleInput): Promise<string> {
  const fields = {
    farmerId: idValue(s.farmerId),
    farmerMasterCode: idValue(s.farmerId),
    EntryDate: apiDate(s.date),
    ItemId: String(s.itemId),
    Qty: two(s.qty),
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
  const json = JSON.stringify([fields]);
  const root = BASE_URL || "https://smartx.shivinfotech.co.in";
  const base = /^https?:/i.test(root) ? root : `${window.location.origin}${root}`;
  const endpoint = `${base}/gateway/Interceptor?path=${SALES_PATH}`;
  const init = asUrlEncoded(json);
  const token = getSession()?.token;
  const requestInfo = {
    url: endpoint,
    method: "POST",
    contentType: "application/x-www-form-urlencoded",
    actionId: SAVE_ID,
    payloadEncoding: "form-urlencoded",
    recordCount: 1,
    recordFields: Object.keys(fields),
  };

  // IMPORTANT: a save is sent exactly ONCE. It must never be retried or sent in
  // a second format automatically -- the server may already have stored the
  // entry even when the reply is slow or an error, so every retry created a
  // duplicate record (one click -> several rows).
  const startedAt = Date.now();
  log("save: request started (one send)", requestInfo);
  let text: string;
  try {
    text = await gatewayText(
      endpoint,
      {
        ...init,
        headers: {
          ...init.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      0,
      true,
    );
    log("save: response received", {
      elapsedMs: Date.now() - startedAt,
      response: text.slice(0, 500),
    });
  } catch (e) {
    console.error("[SaleEntry] save: request failed", {
      ...requestInfo,
      elapsedMs: Date.now() - startedAt,
      errorKind: e instanceof ApiError ? e.kind : "unknown",
      error: e instanceof Error ? e.message : String(e),
    });
    if (e instanceof ApiError && e.kind === "network") {
      console.error(
        "[SaleEntry] save: browser could not read the gateway response. Check DevTools Network for the request status and any CORS error.",
      );
    }
    throw e;
  }

  clearRequestMemo();
  return (
    checkReply(text, "The entry could not be saved.", true) || "Record saved"
  );
}

// Delete one Cattle Feed entry through DPU.
// Same call as the old portal's deleteData (json + id=3), but POST (DPU answers
// DELETE with 405, Allow: POST) and with json + id inside the ENCRYPTED body,
// nothing in the URL. Variants are tried in order; the one the server accepts
// is remembered. Everything is logged: filter the Console by [SaleEntry].
let deleteWinner = "";

export async function deleteSale(row: SaleRow, p: SaleQuery): Promise<string> {
  const iso = apiDate(p.date);
  const rec = {
    ...row.raw,
    Id: row.id,
    autorownum: row.id,
    StationId: stationOf(p.vlcid),
    SalesFlag: wireFlag(p.flag),
    EntryDate: iso,
    farmerMasterCode: pick(row.raw, ["farmerid"]) || row.farmerId,
    AppTransID: "0",
    lastsyncdate: iso,
    BranchId: CATTLE_FEED_BRANCH,
    PlantId: p.plantId,
  };

  type Attempt = { name: string; body: () => string };
  const attempts: Attempt[] = [
    {
      name: "xor {json:text[rec], id:3}",
      body: () =>
        xorBody("payload", { json: JSON.stringify([rec]), id: "3" }),
    },
    {
      name: "xor {json:[rec], id:3}",
      body: () => xorBody("payload", { json: [rec], id: "3" }),
    },
    {
      name: "Xor {json:text[rec], id:3}",
      body: () =>
        xorBody("Payload", { json: JSON.stringify([rec]), id: "3" }),
    },
    {
      name: "xor {data:text[rec], id:3}",
      body: () =>
        xorBody("payload", { data: JSON.stringify([rec]), id: "3" }),
    },
    { name: "xor [rec]", body: () => xorBody("payload", [rec]) },
    { name: "xor rec", body: () => xorBody("payload", rec) },
    {
      name: "aes {json:text[rec], id:3}",
      body: () => aesBody({ json: JSON.stringify([rec]), id: "3" }),
    },
    { name: "aes [rec]", body: () => aesBody([rec]) },
  ];
  const ordered = [
    ...attempts.filter((a) => a.name === deleteWinner),
    ...attempts.filter((a) => a.name !== deleteWinner),
  ];

  log("delete: row", row.id, "-> POST", DPU_SALES, "(encrypted body). record:", rec);
  let text = "";
  let lastError: unknown = null;
  for (const a of ordered) {
    try {
      log(`delete attempt "${a.name}"`);
      const reply = await dpuSales(a.body());
      text = typeof reply === "string" ? reply : JSON.stringify(reply);
      log(`delete attempt "${a.name}" reply:`, text);
      checkReply(text, "The entry could not be deleted.", true);
      deleteWinner = a.name;
      lastError = null;
      break;
    } catch (e) {
      log(`delete attempt "${a.name}" FAILED:`, e instanceof Error ? e.message : e);
      lastError = e;
      if (e instanceof ApiError && e.kind === "auth") throw e;
    }
  }
  if (lastError) throw lastError;
  clearRequestMemo();
  return checkReply(text, "The entry could not be deleted.", true) || "Deleted";
}