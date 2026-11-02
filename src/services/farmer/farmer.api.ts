import { ALL_MILK_CODE, FARMER_MILK_CODES } from '../config';
import { gatewayPostJson, gatewayText, listOf, parseGatewayText, type Priority } from '../http/client';
import { adaptiveCollection, collectionWaves, fanOut, needSession, type CollectionParams, type Emit } from '../http/fanout';
import type { RawFarmerRow, RawLoose } from '../types/raw';
import type { QueryData } from '../http/fanout';
import { apiDate } from '../utils/date';
import { ApiError } from '../http/errors';
import { decryptPayload, decryptXorPayload } from '../../lib/portal/crypto';

/* ------------------------------------------------------------------ */
/*  DPU Farmer Collection (manual test)                                */
/*  Set DPU_FARMER_COLLECTION to false to go back to /home/farmercollection */
/* ------------------------------------------------------------------ */
export const DPU_FARMER_COLLECTION = true;
export const DPU_FARMER_COLLECTION_URL = 'https://dpu.shivinfotech.co.in/api/Login/FarmerCollection';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const nk = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Raw field -> names the DPU reply may use for it (compared ignoring case / symbols). */
const ALIASES: Record<keyof RawFarmerRow, string[]> = {
  farmerid: ['farmerid', 'farmercode', 'farmer', 'farmerno', 'fid'],
  sampleno: ['sampleno', 'sampleid', 'sample'],
  trdate: ['trdate', 'date', 'collectiondate', 'entrydate', 'dtdate'],
  qty: ['qty', 'liter', 'litre', 'liters', 'quantity'],
  Kg: ['kg', 'weight'],
  fat: ['fat'],
  snf: ['snf'],
  clr: ['clr'],
  water: ['water'],
  milktype: ['milktype', 'milk', 'milkcode'],
  Time: ['time', 'collectiontime', 'entrytime'],
  vlccid: ['vlccid', 'villageid', 'vlcid', 'stationid', 'dcscode'],
  shift: ['shift'],
  rtpl: ['rtpl', 'rate', 'ratepl'],
  amount: ['amount', 'amt', 'total'],
  farmername: ['farmername', 'name', 'fname'],
  usbflag: ['usbflag'],
  MaxId: ['maxid', 'id', 'recordid'],
  villagename: ['villagename', 'vlccname', 'dcsname', 'centername'],
  villageagentaddress: ['villageagentaddress', 'address'],
  beneficiaryname: ['beneficiaryname', 'centercode', 'customstationid'],
};

/** "2026-11-02T00:00:00" / "02/11/2026" -> "02 Nov 2026" (the format the pages read). */
function trdateOf(v: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return `${iso[3]} ${MON[Number(iso[2]) - 1]} ${iso[1]}`;
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(v);
  if (dmy) return `${dmy[1]!.padStart(2, '0')} ${MON[Number(dmy[2]) - 1]} ${dmy[3]}`;
  return v;
}

function toRawFarmer(r: RawLoose, vlccid: string, milk: string, shift: string): RawFarmerRow {
  const keys = Object.keys(r);
  const out: Record<string, unknown> = { ...r };
  for (const [field, names] of Object.entries(ALIASES)) {
    for (const want of names) {
      const k = keys.find((x) => nk(x) === want);
      const v = k === undefined ? undefined : r[k];
      if (v !== undefined && v !== null && v !== '') {
        out[field] = typeof v === 'number' ? String(v) : v;
        break;
      }
    }
  }
  if (!out.vlccid) out.vlccid = vlccid;
  if (!out.milktype) out.milktype = milk;
  if (!out.shift && shift !== 'Z') out.shift = shift;
  if (typeof out.trdate === 'string') out.trdate = trdateOf(out.trdate);
  return out as unknown as RawFarmerRow;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const LIST_KEYS = ['data', 'result', 'results', 'rows', 'items', 'table', 'list', 'response', 'farmercollection', 'collection', 'records', 'details'];

/** Finds the array of rows wherever the DPU reply keeps it (root, Data, Result, JSON-in-a-string, nested). */
function findRows(v: unknown, depth = 0): RawLoose[] | null {
  if (depth > 5) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t.startsWith('[') && !t.startsWith('{')) return null;
    try {
      return findRows(JSON.parse(t), depth + 1);
    } catch {
      return null;
    }
  }
  if (Array.isArray(v)) return v.filter(isObj) as RawLoose[];
  if (!isObj(v)) return null;
  const keys = Object.keys(v);
  for (const want of LIST_KEYS) {
    const k = keys.find((x) => nk(x) === want);
    if (k === undefined) continue;
    const got = findRows(v[k], depth + 1);
    if (got) return got;
  }
  for (const k of keys) {
    const got = findRows(v[k], depth + 1);
    if (got && (got.length > 0 || Array.isArray(v[k]))) return got;
  }
  return null;
}

function rowsOfReply(reply: unknown): RawLoose[] {
  if (isObj(reply)) {
    const okKey = Object.keys(reply).find((k) => ['success', 'issuccess', 'status'].includes(nk(k)));
    const ok = okKey ? reply[okKey] : undefined;
    const msgKey = Object.keys(reply).find((k) => ['message', 'msg', 'error'].includes(nk(k)));
    const msg = msgKey ? String(reply[msgKey] ?? '').trim() : '';
    if (ok === false || String(ok).toLowerCase() === 'false') {
      if (!msg || /no\s*(record|data)/i.test(msg)) return [];
      throw new ApiError(msg, 'server');
    }
  }
  const rows = findRows(reply);
  if (rows) return rows;
  const shape = isObj(reply) ? `keys: ${Object.keys(reply).join(', ')}` : typeof reply;
  throw new ApiError(`DPU FarmerCollection reply has no row list (${shape}).`, 'parse');
}

const dpuMilkCodes = (m: CollectionParams['milk']): string[] =>
  m !== 'ALL' ? [m] : ALL_MILK_CODE ? [ALL_MILK_CODE] : FARMER_MILK_CODES;

/**
 * The DPU API answers { success: true, data: "<encrypted>" }.
 * Opens `data` (XOR+base64 with VITE_ENCRYPTION_KEY, or AES "cipher:iv") until real JSON is left.
 */
const B64 = /^[A-Za-z0-9+/_-]{16,}={0,2}$/;
const AES_PACKED = /^[A-Za-z0-9+/=]{8,}:[A-Za-z0-9+/=]{16,}$/;

function openDpuReply(v: unknown, depth = 0): unknown {
  if (depth > 4) return v;
  if (typeof v === 'string') {
    const t = v.replace(/\s+/g, '');
    let opened: unknown = v;
    try {
      if (AES_PACKED.test(t)) opened = decryptPayload(t);
      else if (B64.test(t)) opened = decryptXorPayload(t);
    } catch {
      return v;
    }
    return typeof opened === 'object' && opened !== null ? openDpuReply(opened, depth + 1) : v;
  }
  if (isObj(v)) {
    for (const k of Object.keys(v)) {
      if (!['data', 'response', 'result', 'payload'].includes(k.toLowerCase())) continue;
      const inner = v[k];
      if (typeof inner !== 'string') continue;
      const opened = openDpuReply(inner, depth + 1);
      if (opened !== inner) return opened;
    }
  }
  return v;
}

async function dpuCall(body: Record<string, string>): Promise<unknown> {
  const text = await gatewayText(
    DPU_FARMER_COLLECTION_URL,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    1,
    true,
  );
  const reply = openDpuReply(parseGatewayText(text));
  if (import.meta.env.DEV) {
    console.info('[dpu] FarmerCollection sent:', body);
    console.info('[dpu] FarmerCollection decrypted JSON:', reply); // <- yahan decrypt hua JSON dikhega (F12 > Console)
  }
  return reply;
}

function fetchDpuFarmerCollection(p: CollectionParams, emit?: Emit<RawFarmerRow>) {
  needSession();
  const jobs = p.vlccIds.flatMap((id) =>
    dpuMilkCodes(p.milk).map((code) => async () => {
      const rows = rowsOfReply(
        await dpuCall({
          id,
          stationid: id,
          shift: p.shift,
          milktype: code,
          fromdate: apiDate(p.from),
          todate: apiDate(p.to),
        }),
      ).map((r) => toRawFarmer(r, id, code, p.shift));
      // the pages match rows to centres by vlccid: keep it one of the ids that were asked for
      for (const r of rows) if (!p.vlccIds.includes(String(r.vlccid))) r.vlccid = id;
      if (import.meta.env.DEV) console.info(`[dpu] ${id}/${code}: ${rows.length} rows`, rows[0]);
      return rows;
    }),
  );
  return fanOut<RawFarmerRow>([jobs], emit, true);
}

export const fetchFarmerCollection = (p: CollectionParams, emit?: Emit<RawFarmerRow>) =>
  DPU_FARMER_COLLECTION
    ? fetchDpuFarmerCollection(p, emit)
    : adaptiveCollection<RawFarmerRow>('/home/farmercollection', p, emit);

export const fetchFarmerMilkEntry = (p: CollectionParams & { rateId: string }, emit?: Emit<RawLoose>) =>
  fanOut<RawLoose>(collectionWaves<RawLoose>('/home/FarmerMilkEntry', p, { rateid: p.rateId }), emit, true);

export function fetchFarmerMaster(vlccIds: string[], emit?: Emit<RawLoose>, priority: Priority = 1) {
  needSession();
  return fanOut<RawLoose>(
    [vlccIds.map((id) => async () => (listOf<RawLoose>(await gatewayPostJson('/home/farmermaster', { VillageIds: id }, priority))).map((r) => ({ ...r, vlccid: id })))],
    emit,
    false,
  );
}

export const getFarmer = (vlcid: string, priority: Priority = 1): Promise<unknown> => {
  needSession();
  return gatewayPostJson('/home/farmermaster', { VillageIds: vlcid }, priority);
};

export async function fetchFarmersOf(vlcid: string): Promise<QueryData<RawLoose>> {
  const rows = listOf<RawLoose>(await getFarmer(vlcid)).map((r) => ({ ...r, vlccid: vlcid }));
  return { rows, failed: 0, total: 1, done: 1 };
}