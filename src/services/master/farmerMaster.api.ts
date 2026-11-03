import { clearRequestMemo, listOf, parseGatewayText } from "../http/client";
import {
  dpuGet,
  dpuReadAttempts,
  dpuSaveAttempts,
  type SaveAttempt,
} from "../http/dpu";
import { ApiError } from "../http/errors";
import { encryptXorPayload } from "../../lib/portal/crypto";
import { isObj, pickLike, rowsFrom } from "../utils/loose";
import { pickLoose } from "../farmer/farmerBook";
import type { RawLoose } from "../types/raw";
import type { FarmerInput } from "./farmerMaster.rules.ts";

// DPU API: https://dpu.shivinfotech.co.in/api/Login/<endpoint>
//   POST   FarmerMaster          list of farmers of the given villages
//   GET    FarmerCollectionDpu   highest farmer code of a village (next code = max + 1)
//   GET    GetFarmer             one farmer (edit form)
//   POST   FarmerSave            add / update one farmer
//   POST   FarmerExcelSave       import many farmers
//   PUT    updateFarmerStatus    Active / Inactive
//   DELETE DeleteFarmer          delete one farmer
// Every POST / PUT / DELETE body is { "payload": "<XOR + base64>" } (see the Swagger example { "payload": "string" }).
export const FARMER_LIST_PATH = "/Login/FarmerMaster";
export const FARMER_MAXID_PATH = "/Login/FarmerCollectionDpu";
export const FARMER_GET_PATH = "/Login/GetFarmer";
export const FARMER_SAVE_PATH = "/Login/FarmerSave";
export const FARMER_EXCEL_PATH = "/Login/FarmerExcelSave";
export const FARMER_STATUS_PATH = "/Login/updateFarmerStatus";
export const FARMER_DELETE_PATH = "/Login/DeleteFarmer";

const xor = (v: unknown) => ({ payload: encryptXorPayload(v) });
const q = encodeURIComponent;
const cap = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
const pascal = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [cap(k), v]));

/**
 * The DPU API answers { Success, Message: "<text>" } and puts a list (or a single row, or a number) inside Message
 * as JSON text. This opens that text; anything else is returned unchanged.
 */
export function unwrapReply(reply: unknown): unknown {
  if (!isObj(reply)) return reply;
  for (const k of ["Message", "message", "Data", "data"]) {
    const v = reply[k];
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (/^[[{]/.test(t)) {
      try {
        return unwrapReply(JSON.parse(t));
      } catch {
        /* not JSON */
      }
    } else if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  }
  return reply;
}

export interface MasterRecord extends FarmerInput {
  key: string;
}

const VLC_KEYS = ["vlccid", "villageid", "vlcid", "vlccode", "centerid"];

const PHONE = /^\+?\d[\d\s-]{8,14}$/;
function mobileOf(r: RawLoose): string {
  const exact = pickLoose(r, [
    "mobileno",
    "farmercontact",
    "mobile",
    "mobilenumber",
    "phone",
  ]);
  if (exact) return PHONE.test(exact) ? exact : "";
  const loose = pickLike(r, ["mobile", "contact"]);
  return PHONE.test(loose) ? loose : "";
}

export function mapRecord(r: RawLoose, vlccid: string, i = 0): MasterRecord {
  const status = pickLoose(r, [
    "farmerstatus",
    "status",
    "isactive",
    "active",
  ]).toLowerCase();
  const farmerId = pickLoose(r, [
    "farmer",
    "farmerid",
    "farmercode",
    "farmer_id",
  ]);
  return {
    key: `${vlccid}:${farmerId}:${i}`,
    vlccid,
    farmerId,
    name: pickLoose(r, ["farmername", "name"]),
    nameInBank: pickLoose(r, [
      "nameinbank",
      "farmernameasperbank",
      "farmernamebank",
    ]),
    address: pickLoose(r, ["farmeraddress", "address"]),
    mobile: mobileOf(r),
    bank: pickLoose(r, ["farmerbank", "bankname"]),
    ifsc: (
      pickLoose(r, ["bankifsccode", "ifsc", "farmerbankbranch", "ifsccode"]) ||
      pickLike(r, ["ifsc"])
    ).toUpperCase(),
    account:
      pickLoose(r, [
        "farmerbankac",
        "accountno",
        "bankaccountno",
        "farmerbankaccount",
        "accno",
        "bankac",
        "accountnumber",
      ]) ||
      pickLike(r, ["bankac", "accountno", "accountnumber", "bankaccount"]),
    aadhaar:
      pickLoose(r, ["farmeraadhaar", "aadhaar", "aadhaarno", "aadharno"]) ||
      pickLike(r, ["aadhaar", "aadhar"]),
    active: !["false", "0", "inactive", "n", "no"].includes(status),
  };
}

export async function getData(
  ids: string[],
  customToReal: Record<string, string> = {},
): Promise<MasterRecord[]> {
  if (ids.length === 0) return [];
  const known = new Set(ids);
  const resolve = (v: string) => (known.has(v) ? v : (customToReal[v] ?? v));

  // The server answers 400 "The VillageIds field is required" to { payload: ... }, so this endpoint reads VillageIds
  // straight from the JSON body (plain, not encrypted). The old portal sent { VillageIds: "id1,id2" }. The wrapped
  // layouts stay as the last fallbacks. The layout the server accepts is remembered for the next calls.
  const one = async (list: string[]): Promise<RawLoose[]> => {
    const csv = list.join(",");
    const path = FARMER_LIST_PATH;
    const attempts: SaveAttempt[] = [
      { label: "plain-VillageIds", path, body: { VillageIds: csv } },
      { label: "plain-VillageIds-array", path, body: { VillageIds: list } },
      { label: "plain-villageIds", path, body: { villageIds: csv } },
      { label: "xor-VillageIds", path, body: xor({ VillageIds: csv }) },
      { label: "xor-array-VillageIds", path, body: xor([{ VillageIds: csv }]) },
    ];
    return dpuReadAttempts("FarmerMaster", attempts, (r) => listOf<RawLoose>(r));
  };

  const rows = await one(ids);
  const tagged = rows.map((r) => pickLoose(r, VLC_KEYS));
  let out: Array<{ r: RawLoose; v: string }>;
  if (ids.length === 1) out = rows.map((r) => ({ r, v: ids[0] }));
  else if (tagged.every(Boolean))
    out = rows.map((r, i) => ({ r, v: resolve(tagged[i]) }));
  else {
    const parts = await Promise.all(
      ids.map(async (id) => (await one([id])).map((r) => ({ r, v: id }))),
    );
    out = parts.flat();
  }
  return out.map(({ r, v }, i) => mapRecord(r, v, i)).filter((m) => m.farmerId);
}

export async function getMaxId(vlccid: string): Promise<number | null> {
  let json: unknown;
  try {
    json = unwrapReply(await dpuGet(`${FARMER_MAXID_PATH}?id=${q(vlccid)}`, 0));
  } catch (e) {
    // second spelling of the parameter; if this fails too the caller falls back to the list
    if (!(e instanceof ApiError) || e.kind !== "server") throw e;
    json = unwrapReply(await dpuGet(`${FARMER_MAXID_PATH}?vlccid=${q(vlccid)}`, 0));
  }
  if (typeof json === "number") return json;
  const best: number[] = [];
  const keys = [
    "maxid",
    "maxfarmerid",
    "max",
    "nextid",
    "farmercode",
    "farmerid",
    "farmer",
  ];
  const rows = Array.isArray(json) || isObj(json) ? rowsFrom(json) : [];
  const flat = rows.length ? rows : isObj(json) ? [json] : [];
  for (const r of flat)
    for (const [k, v] of Object.entries(r)) {
      if (!keys.includes(k.toLowerCase().replace(/[^a-z0-9]/g, ""))) continue;
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) best.push(n);
    }
  return best.length ? Math.max(...best) : null;
}

export async function getDataById(
  farmerId: string,
  vlccid: string,
): Promise<MasterRecord | null> {
  const json = unwrapReply(
    await dpuGet(
      `${FARMER_GET_PATH}?farmerid=${q(farmerId)}&vlccid=${q(vlccid)}`,
      0,
    ),
  );
  const row =
    rowsFrom(json)[0] ??
    (Array.isArray(json) ? json.find(isObj) : undefined) ??
    (isObj(json) && !("success" in json) && !("Success" in json) ? json : null);
  if (!row) return null;
  const rec = mapRecord(row, vlccid);
  return { ...rec, farmerId: rec.farmerId || farmerId };
}

export function toPayload(f: FarmerInput, isEdit = false) {
  return {
    farmer: String(f.farmerId).trim(),
    farmername: f.name.trim(),
    address: f.address.trim(),
    mobileno: f.mobile,
    vlccid: String(f.vlccid),
    rfid: null,
    bankcode: f.bank.trim(),
    bnkaccno: f.account,
    bnkifsc: f.ifsc.trim().toUpperCase(),
    nameinbank: f.nameInBank.trim(),
    farmeraadhaar: f.aadhaar,
    farmerstatus: f.active ? "1" : "0",
    action: isEdit ? "update" : "insert",
  };
}

export function toExcelPayload(f: FarmerInput) {
  return {
    farmerid: Number(f.farmerId),
    farmername: f.name.trim(),
    nameinbank: f.nameInBank.trim(),
    farmeraddress: f.address.trim(),
    farmercontact: f.mobile,
    farmerbank: f.bank.trim(),
    bankifsccode: f.ifsc.trim().toUpperCase(),
    farmerbankac: f.account,
    farmerstatus: f.active ? 1 : 0,
    villageid: Number(f.vlccid),
    farmeraadhaar: f.aadhaar,
  };
}

const BAD_LENIENT = /(fail|error|exception|invalid|not\s+(saved|updated))/i;
const BAD_TEXT =
  /(fail|error|exception|invalid|not\s+(saved|deleted|updated|found)|already|duplicate|exist)/i;

export function checkReply(
  text: string,
  fallback: string,
  lenient = false,
): string {
  const t = text.replace(/[\r\n]+/g, " ").trim();
  if (t.startsWith("<"))
    throw new ApiError(
      "The server returned a web page instead of data.",
      "parse",
    );
  let parsed: unknown = t;
  try {
    parsed = parseGatewayText(t);
  } catch {
    parsed = t;
  }
  if (isObj(parsed)) {
    const ok = parsed.Success ?? parsed.success;
    const msg = String(
      parsed.Message ?? parsed.message ?? parsed.msg ?? "",
    ).trim();
    if (ok === false || String(ok).toLowerCase() === "false")
      throw new ApiError(msg || fallback, "server");
    return msg;
  }
  if (
    typeof parsed === "string" &&
    parsed &&
    (lenient ? BAD_LENIENT : BAD_TEXT).test(parsed) &&
    !/^(data\s+)?(saved|updated|deleted|success)/i.test(parsed)
  ) {
    throw new ApiError(parsed.slice(0, 200), "server");
  }
  return typeof parsed === "string" ? parsed : "";
}

// POST /api/Login/FarmerSave   body { payload: "<XOR + base64>" }
// The decrypted root is a LIST of SmartXAccess.Model.SmartX.FarmerSave. The server's own replies show the property
// types: `farmer` is a NUMBER (Int32); `vlccid` and `farmerstatus` are TEXT. Every other field is sent as text.
const numIf = (v: unknown) =>
  typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v;

export async function postData(
  f: FarmerInput,
  isEdit = false,
): Promise<string> {
  const base = toPayload(f, isEdit) as Record<string, unknown>;
  const row = { ...base, farmer: numIf(base.farmer) };
  const message = await dpuSaveAttempts("FarmerSave", [
    { label: "xor-array-farmer-int", path: FARMER_SAVE_PATH, body: xor([row]) },
  ]);
  clearRequestMemo();
  return message;
}

// POST /api/Login/FarmerExcelSave  (root = list; the field types are tried the same way)
export async function postExcel(list: FarmerInput[]): Promise<string> {
  const rows = list.map(toExcelPayload) as Array<Record<string, unknown>>;
  const str = (k: string) => (r: Record<string, unknown>) => ({ ...r, [k]: String(r[k]) });
  const villageText = rows.map(str("villageid"));
  const villageStatusText = villageText.map(str("farmerstatus"));
  const allText = villageStatusText.map(str("farmerid"));
  const path = FARMER_EXCEL_PATH;
  const message = await dpuSaveAttempts("FarmerExcelSave", [
    { label: "xor-array", path, body: xor(rows) },
    { label: "xor-array-village-text", path, body: xor(villageText) },
    { label: "xor-array-village-status-text", path, body: xor(villageStatusText) },
    { label: "xor-array-all-text", path, body: xor(allText) },
  ]);
  clearRequestMemo();
  return message;
}

export interface StatusChange {
  vlccid: string;
  farmerId: string;
  active: boolean;
}

// PUT /api/Login/updateFarmerStatus?villageid=&farmerid0=&farmerid1=
// farmerid0 = ids to make Inactive, farmerid1 = ids to make Active (one call per village). The values also stay in
// the URL, like the other DPU PUT calls.
export async function updateFarmerStatus(all: StatusChange[]): Promise<string> {
  const byVillage = new Map<string, { off: string[]; on: string[] }>();
  for (const c of all) {
    const g = byVillage.get(c.vlccid) ?? { off: [], on: [] };
    (c.active ? g.on : g.off).push(String(c.farmerId));
    byVillage.set(c.vlccid, g);
  }
  let last = "";
  for (const [villageid, g] of byVillage) {
    const params = {
      villageid: String(villageid),
      farmerid0: g.off.join(","),
      farmerid1: g.on.join(","),
    };
    const path = `${FARMER_STATUS_PATH}?villageid=${q(params.villageid)}&farmerid0=${q(params.farmerid0)}&farmerid1=${q(params.farmerid1)}`;
    last = await dpuSaveAttempts(
      "updateFarmerStatus",
      [
        { label: "xor-params", path, body: xor(params) },
        { label: "xor-array", path, body: xor([params]) },
        { label: "xor-params-pascal", path, body: xor(pascal(params)) },
        { label: "xor-query-text", path, body: xor(new URLSearchParams(params).toString()) },
      ],
      "PUT",
    );
  }
  clearRequestMemo();
  return last;
}

// DELETE /api/Login/DeleteFarmer?farmerid=&vlccid=
export async function deleteFarmer(
  farmerId: string,
  vlccid: string,
): Promise<string> {
  const params = { farmerid: String(farmerId), vlccid: String(vlccid) };
  const path = `${FARMER_DELETE_PATH}?farmerid=${q(params.farmerid)}&vlccid=${q(params.vlccid)}`;
  const message = await dpuSaveAttempts(
    "DeleteFarmer",
    [
      { label: "xor-params", path, body: xor(params) },
      { label: "xor-array", path, body: xor([params]) },
      { label: "xor-params-pascal", path, body: xor(pascal(params)) },
    ],
    "DELETE",
  );
  clearRequestMemo();
  return message;
}
