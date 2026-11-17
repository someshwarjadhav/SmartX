import { useEffect, useState } from "react";
import { getSession } from "../services/session";
import { GLOBALS } from "../lib/portal/global";
import {
  getMccRoute,
  getVillageDetails,
} from "../services/master/vlcMaster.api";
import { getData as getFarmerMaster } from "../services/master/farmerMaster.api";

export interface VlccDirectory {
  mobile: Record<string, string>;
  registered: Record<string, number>;
  loading: boolean;
}

const EMPTY: VlccDirectory = { mobile: {}, registered: {}, loading: false };

const cache = new Map<
  string,
  { mobile: Record<string, string>; registered: Record<string, number> }
>();

async function loadMobiles(): Promise<Record<string, string>> {
  const s = getSession();
  const mccid =
    s?.mccLoginId || GLOBALS.mccLoginId || s?.mccId || GLOBALS.mccid || "";
  const plantid = GLOBALS.plantid || "";
  if (!mccid) return {};
  const routes = await getMccRoute(mccid, plantid);
  const lists = await Promise.all(
    routes.map((r) => getVillageDetails(mccid, r.routeId).catch(() => [])),
  );
  const out: Record<string, string> = {};
  for (const list of lists) {
    for (const v of list) {
      const phone = (v.contact || "").trim();
      if (phone && v.villageId && !out[v.villageId]) out[v.villageId] = phone;
    }
  }
  return out;
}

async function loadRegistered(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const records = await getFarmerMaster(ids, s_customToReal());
  const out: Record<string, number> = {};
  for (const r of records) out[r.vlccid] = (out[r.vlccid] ?? 0) + 1;
  return out;
}

const s_customToReal = (): Record<string, string> => {
  const map = getSession()?.stationByVlcc ?? {};
  const out: Record<string, string> = {};
  for (const [real, custom] of Object.entries(map))
    if (custom) out[custom] = real;
  return out;
};

export function useVlccDirectory(
  ids: string[],
  enabled: boolean,
): VlccDirectory {
  const scope = getSession()?.scope ?? "";
  const key = `${scope}|${ids.join(",")}`;
  const [state, setState] = useState<VlccDirectory>(() => {
    const hit = cache.get(key);
    return hit ? { ...hit, loading: false } : EMPTY;
  });

  useEffect(() => {
    if (!enabled || !ids.length) return;
    const hit = cache.get(key);
    if (hit) {
      setState({ ...hit, loading: false });
      return;
    }
    let alive = true;
    setState((x) => ({ ...x, loading: true }));
    void Promise.all([
      loadMobiles().catch(() => ({}) as Record<string, string>),
      loadRegistered(ids).catch(() => ({}) as Record<string, number>),
    ]).then(([mobile, registered]) => {
      if (Object.keys(mobile).length || Object.keys(registered).length)
        cache.set(key, { mobile, registered });
      if (alive) setState({ mobile, registered, loading: false });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  return state;
}
