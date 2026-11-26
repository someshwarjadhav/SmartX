import { GLOBALS } from "../lib/portal/global";
import {
  DATA_KEY,
  LOGIN_KEY,
  MENU_KEY,
  vaultClear,
  vaultLoad,
  vaultSave,
} from "../lib/portal/vault";
import { mapLoginResponse, type LoginProfile } from "./auth/auth.api.ts";
import { getCenter, getDpuCenter, parseCenters } from "./center/center.api.ts";
import { parseMenu, getMenu, type MenuNode } from "./menu/menu.api.ts";
import {
  EMPTY_REPORT_CONFIG,
  getReportAccess,
  parseReportConfig,
  type ReportConfig,
} from "./report/report.api.ts";
import { setSession } from "./session";
import {
  clearPlantSettings,
  restorePlantSettings,
} from "./settings/plantSettings.api.ts";
import type { Center } from "./mappers/center.mapper.ts";
import {
  getMccRoute,
  getVillageDetails,
  type VlcRecord,
} from "./master/vlcMaster.api.ts";

interface SessionData {
  centers: Center[];
  menu: MenuNode[];
  report: ReportConfig;
}
interface RawData {
  centers: unknown;
  menu: unknown;
  report: unknown;
  /** VLC id -> custom station id, read from the VLC master API (getVillageDetails). Missing in data saved by older versions. */
  stations?: Record<string, string> | null;
}
interface StoredLogin {
  username: string;
  record: unknown;
}
interface StoredData {
  userId: string;
  raw: RawData;
}
interface StoredMenu {
  userId: string;
  raw: unknown;
}

const EMPTY: SessionData = {
  centers: [],
  menu: [],
  report: EMPTY_REPORT_CONFIG,
};
let data: SessionData = EMPTY;
let loaded = false;
let rawData: RawData | null = null;
let errors: Record<string, string> = {};
let masterStations: Record<string, string> = {};

export const getCenters = (): Center[] => data.centers;
export const getMenuTree = (): MenuNode[] => data.menu;

const listeners = new Set<() => void>();
export const subscribeMenu = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

function persist(userId: string, raw: RawData) {
  vaultSave(DATA_KEY, {
    userId,
    raw: { ...raw, menu: null },
  } satisfies StoredData);
  if (raw.menu !== null && raw.menu !== undefined)
    vaultSave(MENU_KEY, { userId, raw: raw.menu } satisfies StoredMenu);
}

export async function refreshMenu(userId: string): Promise<void> {
  try {
    const raw = await getMenu(userId);
    if (!rawData) return;
    rawData = { ...rawData, menu: raw };
    data = { ...data, menu: parseMenu(raw) };
    persist(userId, rawData);
    listeners.forEach((fn) => fn());
  } catch (e) {}
}

let menuTried = false;
export async function ensureMenu(userId: string): Promise<void> {
  if (
    menuTried ||
    !rawData ||
    (rawData.menu !== null && rawData.menu !== undefined)
  )
    return;
  menuTried = true;
  await refreshMenu(userId);
}
export const getReportConfig = (): ReportConfig => data.report;

export const getSessionErrors = () => errors;
export const getRawSessionData = (): RawData | null => rawData;
export const getSavedLoginRecord = (): unknown =>
  vaultLoad<StoredLogin>(LOGIN_KEY)?.record ?? null;
export const isSessionDataLoaded = () => loaded;

/** Every VLC of the MCC (all routes) from the VLC master API. Empty when the API gives nothing. */
async function loadMasterVillages(profile: LoginProfile): Promise<VlcRecord[]> {
  const mccid = (profile.mccId ?? "").trim();
  const plantid = (profile.plantId ?? "").trim();
  if (!mccid) return [];
  const routes = await getMccRoute(mccid, plantid);
  const lists = await Promise.all(
    routes.map((r) => getVillageDetails(mccid, r.routeId).catch(() => [])),
  );
  const seen = new Set<string>();
  const out: VlcRecord[] = [];
  for (const list of lists)
    for (const v of list)
      if (v.villageId && !seen.has(v.villageId)) {
        seen.add(v.villageId);
        out.push(v);
      }
  return out;
}

/** VLC id -> custom station id from the VLC master (every route of the MCC). */
const stationCodesOf = (villages: VlcRecord[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const v of villages)
    if (v.villageId && v.customId && v.customId !== v.villageId)
      out[v.villageId] = v.customId;
  return out;
};

/**
 * Ids to ask the centre API for: the login SessionID ids PLUS every VLC in the VLC master.
 * The login ids are fixed at sign-in time, so a VLC created later was never requested
 * and never reached the centre dropdowns.
 */
const idsWithMaster = (profile: LoginProfile, villages: VlcRecord[]): string =>
  [...new Set([...(profile.vlccIds ?? []), ...villages.map((v) => v.villageId)])]
    .filter(Boolean)
    .join(",");

function hydrate(raw: RawData) {
  rawData = raw;
  masterStations = raw.stations ?? {};
  data = {
    centers: raw.centers ? parseCenters(raw.centers) : [],
    menu: raw.menu ? parseMenu(raw.menu) : [],
    report: raw.report ? parseReportConfig(raw.report) : EMPTY_REPORT_CONFIG,
  };
}

export function applySession(profile: LoginProfile) {
  const centers = data.centers;
  const names: Record<string, string> = { ...(profile.vlccNames ?? {}) };
  for (const c of centers) if (c.name) names[c.id] = c.name;
  // custom station id of every VLC - weakest source first, the strongest one (VLC master) last:
  // login CustomStationId (only when it lines up with SessionID) < centre API < VLC master API
  const stationByVlcc: Record<string, string> = { ...(profile.stationByVlcc ?? {}) };
  for (const c of centers)
    if (c.stationId && c.stationId !== c.id) stationByVlcc[c.id] = c.stationId;
  Object.assign(stationByVlcc, masterStations);
  setSession({
    ...profile,
    vlccIds: centers.length ? centers.map((c) => c.id) : profile.vlccIds,
    vlccNames: names,
    stationByVlcc,
  });
  Object.assign(GLOBALS, {
    centerdata: centers,
    userid: profile.userId ?? null,
    stationid: profile.centerStationId ?? null,
  });
}

async function loadCenters(
  profile: LoginProfile,
  villagesP: Promise<VlcRecord[]>,
): Promise<unknown> {
  const villages = await villagesP.catch(() => [] as VlcRecord[]);
  // vlccIds (login SessionID) FIRST: that is what the old SmartX sends, and it returns every VLC.
  // centerStationId is the login CustomStationId text ("7090500,JNS0100,..."): it matches only one VLC, so it must not win.
  const candidates = [
    idsWithMaster(profile, villages),
    profile.vlccIds?.join(","),
    profile.centerStationId,
    profile.mccId,
    profile.stationId,
  ]
    .map((x) => (x ?? "").trim())
    .filter((x, i, all) => x && all.indexOf(x) === i);
  if (!candidates.length) throw new Error("no station id in the login record");
  let answeredEmpty: unknown = null;
  let lastError: unknown;
  for (const id of candidates) {
    try {
      const reply = await getCenter(id);
      if (parseCenters(reply).length > 0) {
        return reply;
      }
      answeredEmpty = reply;
    } catch (e) {
      lastError = e;
    }
  }
  if (answeredEmpty !== null) return answeredEmpty;
  throw lastError ?? new Error("the portal returned no centres");
}

export async function loadSessionData(profile: LoginProfile): Promise<void> {
  const { userId, centerStationId } = profile;
  errors = {};
  const missing = (what: string) =>
    Promise.reject(new Error(`no ${what} in the login record`));
  const villagesP = loadMasterVillages(profile);
  const [c, m, r, st] = await Promise.allSettled([
    centerStationId || profile.vlccIds?.length
      ? loadCenters(profile, villagesP)
      : missing("station id"),
    userId ? getMenu(userId) : missing("user id"),
    userId ? getReportAccess(userId) : missing("user id"),
    villagesP.then(stationCodesOf),
  ]);
  const value = (res: PromiseSettledResult<unknown>, name: string) => {
    if (res.status === "fulfilled") return res.value;
    const why =
      res.reason instanceof Error ? res.reason.message : String(res.reason);
    errors[name] = why;
    return null;
  };
  const raw: RawData = {
    centers: value(c, "getCenter"),
    menu: value(m, "getMenu"),
    report: value(r, "getReportAccess"),
    stations:
      st.status === "fulfilled" && Object.keys(st.value).length
        ? st.value
        : null,
  };
  hydrate(raw);

  loaded = raw.centers !== null || !centerStationId;
  persist(userId ?? "", raw);
  menuTried = false;
}

export function saveLogin(username: string, record: unknown) {
  vaultSave(LOGIN_KEY, { username, record } satisfies StoredLogin);
}

export function restoreSession(): LoginProfile | null {
  const login = vaultLoad<StoredLogin>(LOGIN_KEY);
  if (!login || !("record" in login)) return null;
  let profile: LoginProfile;
  try {
    profile = mapLoginResponse(login.record, login.username || "");
  } catch {
    return null;
  }
  const saved = vaultLoad<StoredData>(DATA_KEY);
  if (saved && saved.userId === (profile.userId ?? "") && saved.raw) {
    const menu = vaultLoad<StoredMenu>(MENU_KEY);
    const raw =
      menu && menu.userId === (profile.userId ?? "") && menu.raw
        ? { ...saved.raw, menu: menu.raw }
        : saved.raw;
    hydrate(raw);
    loaded = raw.centers !== null || !profile.centerStationId;
  } else {
    data = EMPTY;
    loaded = false;
    rawData = null;
  }
  applySession(profile);
  restorePlantSettings(profile.plantId);
  return profile;
}

export function clearSessionData() {
  clearPlantSettings();
  data = EMPTY;
  loaded = false;
  rawData = null;
  menuTried = false;
  vaultClear();
  Object.assign(GLOBALS, { userid: null, stationid: null });
}

export async function refreshSessionCenters(): Promise<void> {
  const record = getSavedLoginRecord();
  if (!record) return;
  let profile: LoginProfile;
  try {
    profile = mapLoginResponse(
      record,
      vaultLoad<StoredLogin>(LOGIN_KEY)?.username || "",
    );
  } catch {
    return;
  }
  const villages = await loadMasterVillages(profile).catch(
    () => [] as VlcRecord[],
  );
  const ids = [
    idsWithMaster(profile, villages),
    profile.vlccIds?.join(","),
    profile.centerStationId,
    profile.mccId,
    profile.stationId,
  ]
    .map((x) => (x ?? "").trim())
    .filter((x, i, all) => x && all.indexOf(x) === i);
  for (const id of ids) {
    try {
      const centers = await getDpuCenter(id);
      const parsed = parseCenters(centers);
      if (!parsed.length) continue;
      const fresh = stationCodesOf(villages);
      if (Object.keys(fresh).length) masterStations = fresh;
      data = { ...data, centers: parsed };
      rawData = {
        ...(rawData ?? { centers: null, menu: null, report: null }),
        centers,
        stations: Object.keys(masterStations).length ? masterStations : null,
      };
      persist(profile.userId ?? "", rawData);
      applySession(profile);
      listeners.forEach((fn) => fn());
      return;
    } catch (e) {}
  }
}