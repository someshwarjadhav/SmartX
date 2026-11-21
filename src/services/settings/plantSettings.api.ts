import { DPU } from '../http/dpuEndpoints';
import { dpuUrl, openDpuReply } from '../http/dpu';
import { gatewayText, parseGatewayText } from '../http/client';
import { ApiError } from '../http/errors';
import { getSession } from '../session';
import { norm, rowsFrom, type Obj } from '../utils/loose';
import { PLANT_KEY, vaultLoad, vaultSave } from '../../lib/portal/vault';



export const DEFAULT_PLANT_ID = '0';
export const DEFAULT_EXCEL_VERSION = 1;


const PLANT_KEYS = ['plantid', 'plant_id', 'plantcode'].map(norm);
const EXCEL_KEYS = ['excelversion', 'excel_version', 'excelver', 'exceltype', 'exlversion'].map(norm);

export interface PlantSettingRow {
  plantId: string;
  excelVersion: number;
  raw: Obj;
}

export interface PlantSettings {

  plantId: string;

  matchedPlantId: string;
  excelVersion: number;
}

const pick = (row: Obj, wanted: string[]): unknown => {
  const key = Object.keys(row).find((k) => wanted.includes(norm(k)));
  return key === undefined ? undefined : row[key];
};

const idOf = (v: unknown): string => {
  const t = String(v ?? '').trim();
  if (t === '') return '';
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : t; 
};

const versionOf = (v: unknown): number => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_EXCEL_VERSION;
};

/** raw (already decrypted) reply -> clean rows */
export function parsePlantRows(reply: unknown): PlantSettingRow[] {
  return rowsFrom(reply)
    .map((raw) => ({
      plantId: idOf(pick(raw, PLANT_KEYS)),
      excelVersion: versionOf(pick(raw, EXCEL_KEYS)),
      raw,
    }))
    .filter((r) => r.plantId !== '');
}

/** The matching logic (pure function, easy to test). */
export function resolvePlantSettings(rows: PlantSettingRow[], loginPlantId: string | undefined | null): PlantSettings {
  const plantId = idOf(loginPlantId);
  const exact = plantId ? rows.find((r) => r.plantId === plantId) : undefined;
  const row = exact ?? rows.find((r) => r.plantId === DEFAULT_PLANT_ID);
  return {
    plantId,
    matchedPlantId: row?.plantId ?? '',
    excelVersion: row?.excelVersion ?? DEFAULT_EXCEL_VERSION,
  };
}

/* ---------- state kept for the whole session ---------- */

const NORMAL: PlantSettings = { plantId: '', matchedPlantId: '', excelVersion: DEFAULT_EXCEL_VERSION };
let current: PlantSettings = NORMAL;
let loaded = false;

export const getPlantSettings = (): PlantSettings => current;
export const getExcelVersion = (): number => current.excelVersion;
export const isPlantSettingsLoaded = (): boolean => loaded;

export function clearPlantSettings(): void {
  current = NORMAL;
  loaded = false;
}

/** Page reload: take the answer saved for this login (no new API call). Returns true when something valid was restored. */
export function restorePlantSettings(loginPlantId: string | undefined | null): boolean {
  const saved = vaultLoad<PlantSettings>(PLANT_KEY);
  if (!saved || saved.plantId !== idOf(loginPlantId)) return false;
  current = { plantId: saved.plantId, matchedPlantId: saved.matchedPlantId, excelVersion: versionOf(saved.excelVersion) };
  loaded = true;
  return true;
}

/** One call. First WITHOUT a token (like every other DPU call - no CORS preflight); if the server says 401/403, again WITH the login token. */
async function fetchSettingsReply(station: string): Promise<unknown> {
  const url = dpuUrl(`${DPU.settings}?stationid=${encodeURIComponent(station)}`);
  const get = async (headers: Record<string, string>) =>
    openDpuReply(parseGatewayText(await gatewayText(url, { method: 'GET', cache: 'no-store', headers }, 0, true)), 0, true);
  try {
    return await get({});
  } catch (e) {
    const token = getSession()?.token;
    if (e instanceof ApiError && e.kind === 'auth' && token) return get({ Authorization: `Bearer ${token}` });
    throw e;
  }
}


export async function loadPlantSettings(
  loginPlantId: string | undefined | null,
  stationId: string | undefined | null,
): Promise<PlantSettings> {
  // the API needs ?stationid=  (without it: 400 "The stationid field is required.")
  const station = String(stationId ?? '').trim().split(/[,;\s]+/)[0] ?? '';
  try {
    if (!station) throw new Error('no station id in the login record');
    const rows = parsePlantRows(await fetchSettingsReply(station));
    current = resolvePlantSettings(rows, loginPlantId);
    if (import.meta.env.DEV) {
      console.info('[plant settings] rows:', rows.map((r) => `${r.plantId}->v${r.excelVersion}`).join(', ') || '(none)', '| login PlantId:', current.plantId || '(none)', '| used row:', current.matchedPlantId || '(none)', '| EXCEL VERSION:', current.excelVersion);
    }
    loaded = true;
    vaultSave(PLANT_KEY, current);
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[plant settings] failed, using excel version 1:', e instanceof Error ? e.message : e);
    current = { ...NORMAL, plantId: idOf(loginPlantId) };
    loaded = true;
  }
  return current;
}
