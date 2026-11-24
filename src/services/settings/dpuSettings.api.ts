import { ApiError } from '../http/errors';
import { listOf } from '../http/client';
import { norm } from '../utils/loose';
import { DPU } from '../http/dpuEndpoints';
import { settingsRead, settingsSave } from './settingsHttp';


type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function assertSaved(reply: unknown) {
  if (!isObj(reply)) return;
  const message = String(reply.Message ?? reply.message ?? '').trim();
  const refused = (reply.Success ?? reply.success) === false && !/^(done|success|saved|ok|insert|record|data saved)/i.test(message);
  if (refused) throw new ApiError(message || 'The portal did not save the DPU settings.', 'server');
}

const get = (obj: Obj, ...keys: string[]): unknown => {
  const want = keys.map(norm);
  const k = Object.keys(obj).find((x) => want.includes(norm(x)));
  return k === undefined ? undefined : obj[k];
};

const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const t = String(v ?? '').trim().toLowerCase();
  return t === 'true' || t === '1' || t === 'yes' || t === 'y';
};

function firstRecord(json: unknown): Obj | null {
  if (Array.isArray(json)) return json.find(isObj) ?? null;
  if (isObj(json)) {
    for (const k of ['Data', 'data', 'Result', 'result']) {
      const inner = json[k];
      if (Array.isArray(inner)) return inner.find(isObj) ?? null;
      if (isObj(inner)) return inner;
    }
    return json;
  }
  return null;
}


function stamp(r: Obj): number {
  const dt = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2}))?(?:\D+(\d{1,2}))?(?:\D+(\d{1,2}))?/.exec(String(get(r, 'datetime') ?? ''));
  if (dt) return Date.UTC(+dt[1], +dt[2] - 1, +dt[3], +(dt[4] ?? 0), +(dt[5] ?? 0), +(dt[6] ?? 0));
  const e = String(get(r, 'EntryDate') ?? '');
  const us = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/.exec(e);
  if (us) return Date.UTC(+us[3], +us[1] - 1, +us[2], +(us[4] ?? 0), +(us[5] ?? 0), +(us[6] ?? 0));
  const t = Date.parse(e);
  return Number.isNaN(t) ? 0 : t;
}


function latestRecord(rows: Obj[]): Obj | null {
  let best: Obj | null = null;
  let bestAt = -Infinity;
  for (const r of rows) {
    const at = stamp(r);
    if (at >= bestAt) { best = r; bestAt = at; }
  }
  return best;
}


function readRecord(json: unknown): Obj | null {
  if (isObj(json)) {
    if ((json.Success ?? json.success) === false) {
      const text = [json.Message ?? json.message, json.Details ?? json.details].map((x) => String(x ?? '').trim()).filter(Boolean).join(' - ');
      if (/no\s*(record|data)|not\s*found/i.test(text)) return null;
      throw new ApiError(text || 'The portal did not return the DPU settings.', 'server');
    }
    if ('AutoWeight' in json || 'MilkType' in json || 'MStartTime' in json) return json;
  }
  try {
    return latestRecord(listOf<Obj>(json).filter(isObj));
  } catch (e) {
    if (e instanceof ApiError && e.kind === 'parse') return firstRecord(json);
    throw e;
  }
}

export const DPU_MILK_TYPES: Array<{ value: string; label: string }> = [
  { value: '1', label: 'Cow' },
  { value: '2', label: 'Buffalo' },
  { value: '3', label: 'Both' },
];

const milkOf = (v: unknown): string => {
  const t = String(v ?? '').trim().toUpperCase();
  return ({ C: '1', B: '2', Z: '3' } as Record<string, string>)[t] ?? (t || '1');
};
export const INTERVAL_COUNT = 10;

export interface DpuInterval { time: string; amount: string }

export interface DpuSettings {
  stationId: string;
  autoWeight: boolean;
  autoFat: boolean;
  autoShift: boolean;
  autoTear: boolean;
  realData: boolean;
  multiCol: boolean;
  dpuSeize: boolean;
  dpuSync: boolean;
  milkType: string;
  mStart: string;
  mEnd: string;
  eStart: string;
  eEnd: string;
  operatorPass: string;
  supervisorPass: string;
  adminPass: string;
  intervals: DpuInterval[];
}

export const emptyDpuSettings = (stationId = ''): DpuSettings => ({
  stationId, autoWeight: false, autoFat: false, autoShift: false, autoTear: false, realData: false, multiCol: false, dpuSeize: false, dpuSync: false,
  milkType: '1', mStart: '00:00', mEnd: '00:00', eStart: '00:00', eEnd: '00:00',
  operatorPass: '', supervisorPass: '', adminPass: '',
  intervals: Array.from({ length: INTERVAL_COUNT }, () => ({ time: '00:00', amount: '0' })),
});

const timeOf = (v: unknown): string => {
  const m = /(\d{1,2}):(\d{2})/.exec(String(v ?? ''));
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '00:00';
};
const pass = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(0, 4);
const amountOf = (v: unknown) => { const t = String(v ?? '').trim(); return t === '' || Number.isNaN(Number(t)) ? '0' : t; };

export const buildDpuFetchPayload = (stationId: string) => ({ StationId: stationId });

export async function getDpuSettings(stationId: string): Promise<DpuSettings> {
  const rec = await settingsRead('GetDPUSettings', DPU.getDpuSettings, buildDpuFetchPayload(stationId), readRecord);
  const out = emptyDpuSettings(stationId);
  if (!rec) return out;
  return {
    stationId,
    autoWeight: toBool(get(rec, 'AutoWeight')),
    autoFat: toBool(get(rec, 'AutoFat')),
    autoShift: toBool(get(rec, 'AutoShift')),
    autoTear: toBool(get(rec, 'AutoTear')),
    realData: toBool(get(rec, 'RealData')),
    multiCol: toBool(get(rec, 'MultiCol')),
    dpuSeize: toBool(get(rec, 'dpuseize')),
  
    dpuSync: String(get(rec, 'DPUPass') ?? '').trim() === '1',
    milkType: milkOf(get(rec, 'MilkType')),
    mStart: timeOf(get(rec, 'MStartTime')),
    mEnd: timeOf(get(rec, 'MEndTime')),
    eStart: timeOf(get(rec, 'EStartTime')),
    eEnd: timeOf(get(rec, 'EEndTime')),
    operatorPass: pass(get(rec, 'p1')),
    supervisorPass: pass(get(rec, 'p2')),
    adminPass: pass(get(rec, 'p3')),
    intervals: out.intervals.map((_, i) => ({ time: timeOf(get(rec, `i${i + 1}`)), amount: amountOf(get(rec, `v${i + 1}`)) })),
  };
}

const flag = (b: boolean) => (b ? 1 : 0);

const nonce = (n = 15) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};


const boolText = (b: boolean) => (b ? 'True' : 'False');

export function buildDpuPayload(s: DpuSettings, entryDate: string): Record<string, string> {
  const payload: Record<string, string> = {
    StationId: String(s.stationId),
    EntryDate: entryDate,
    AutoWeight: boolText(s.autoWeight),
    AutoFat: boolText(s.autoFat),
    AutoShift: boolText(s.autoShift),
    AutoTear: boolText(s.autoTear),
    RealData: boolText(s.realData),
    MultiCol: boolText(s.multiCol),
    DPUPass: s.dpuSync ? '1' : '0',
    MilkType: s.milkType || '0',
    MStartTime: s.mStart,
    MEndTime: s.mEnd,
    EStartTime: s.eStart,
    EEndTime: s.eEnd,
    datetime: entryDate,
    p1: s.operatorPass,
    p2: s.supervisorPass,
    p3: s.adminPass,
    p4: '0000',
  };
  s.intervals.forEach((row, i) => {
    payload[`i${i + 1}`] = row.time ?? '';
  });
  s.intervals.forEach((row, i) => {
    const t = String(row.amount ?? '').trim();
    payload[`v${i + 1}`] = t === '' || Number.isNaN(Number(t)) ? '0' : t;
  });
  payload.encryptionkey = nonce();
  payload.dpuseize = String(flag(s.dpuSeize));
  return payload;
}

export async function saveDpuSettings(s: DpuSettings, entryDate: string): Promise<void> {
  assertSaved(await settingsSave('SaveDPUSettings', DPU.saveDpuSettings, buildDpuPayload(s, entryDate)));
}
