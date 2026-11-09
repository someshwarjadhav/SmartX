import { useEffect, useMemo, useState } from 'react';
import type { CollectionEntry, Shift } from '../data/farmerCollection';
import type { MilkKind } from '../types';
import { getSession } from '../services/session';
import { useQuery, type QueryState } from './useQuery';
import { fetchFarmerCollection } from '../services/farmer/farmer.api.ts';
import { fetchVlccCollection } from '../services/vlcc/vlcc.api.ts';
import { mapFarmers } from '../services/mappers/farmer.mapper.ts';
import { mapVlcc } from '../services/mappers/vlcc.mapper.ts';
import { useCenters } from './useSessionData';
import { GLOBALS } from '../lib/portal/global';
import { fetchDpuFarmerMaster, type MasterFarmerOption } from '../services/farmer/farmer.api.ts';
import { getDpuCenter, parseCenters } from '../services/center/center.api.ts';
import type { Center } from '../services/mappers/center.mapper.ts';
import { isoFromTrdate } from '../services/utils/date';
import { time24 } from '../lib/format';
import { titleCase, stripRoute } from '../lib/titleCase';
import { getMccRoute, getVillageDetails } from '../services/master/vlcMaster.api';
import type { RawFarmerRow, RawVlccRow } from '../services/types/raw';

export interface LiveReportState<T> {
  rows: T[];
  /** true only while there is nothing to show yet (first rows arrive -> the table appears) */
  loading: boolean;
  /** true while requests are still running, even if some rows are already on screen */
  fetching: boolean;
  /** requests finished so far (done of total) for the progress strip */
  done: number;
  error: string | null;
  retry: () => void;
  updatedAt: number | null;
  /** requests that still failed after a retry (data is incomplete when > 0) */
  failed: number;
  total: number;
}
export interface LiveFilter {
  from: string;
  to: string;
  shift?: Shift | 'both';
  milk?: MilkKind | 'both';
  vlccId?: string | 'all';
  /** ask only these centres (used when a page already knows which centres it needs, e.g. one plant) */
  vlccIds?: string[];
}
/* ---------- Centres for the report dropdowns (DPU FarmerCollectionDpu) ---------- */

const centreCache = new Map<string, Promise<Center[]>>();

type CentreTry = { param: 'id' | 'stationid' | 'userid' | 'mccid'; value: string };

function loadReportCentres(key: string, tries: CentreTry[]): Promise<Center[]> {
  const hit = centreCache.get(key);
  if (hit) return hit;
  const p = (async (): Promise<Center[]> => {
    for (const t of tries) {
      try {
        const list = parseCenters(await getDpuCenter(t.value, t.param));
        if (list.length) {
          console.info(`[centres] FarmerCollectionDpu?${t.param}=${t.value} -> ${list.length} centres`, list.map((c) => `${c.name || '(no name)'} | ${c.id}`));
          return list;
        }
        console.warn(`[centres] FarmerCollectionDpu?${t.param}=${t.value} answered but no centre rows were recognised`);
      } catch (e) {
        console.warn(`[centres] FarmerCollectionDpu?${t.param}=${t.value} failed:`, e instanceof Error ? e.message : e);
      }
    }
    console.warn('[centres] DPU centre API gave no centres - the centres saved at login are shown instead.');
    return [];
  })();
  centreCache.set(key, p);
  void p.then((list) => { if (!list.length) centreCache.delete(key); });
  return p;
}

/* ---------- Routes (Plant/MCC dropdown = the login's routes, same as the live portal) ---------- */

type RouteOf = Map<string, { id: string; name: string }>;
const routeCache = new Map<string, Promise<RouteOf>>();

/** getMccRoute (the routes of the login) + getVillageDetails (the centres of every route) -> centre id -> route */
function loadRouteMap(mccid: string, plantid: string, total: number): Promise<RouteOf> {
  const key = `${mccid}|${plantid}`;
  const hit = routeCache.get(key);
  if (hit) return hit;
  const p = (async (): Promise<RouteOf> => {
    const out: RouteOf = new Map();
    try {
      const routes = await getMccRoute(mccid, plantid);
      const lists = await Promise.all(routes.map((r) => getVillageDetails(mccid, r.routeId).then((v) => ({ r, v })).catch(() => ({ r, v: [] as Awaited<ReturnType<typeof getVillageDetails>> }))));
      for (const { r, v } of lists) {
        // an answer that holds every centre of the login for each route is the "all villages" fallback, not this route's own list
        if (routes.length > 1 && total > 0 && v.length >= total) continue;
        for (const x of v) if (x.villageId && !out.has(x.villageId)) out.set(x.villageId, { id: r.routeId, name: r.routeName || r.routeId });
      }
      console.info(`[routes] ${routes.length} route(s):`, routes.map((r) => `${r.routeName} | ${r.routeId}`), `-> ${out.size} centres placed`);
    } catch (e) {
      console.warn('[routes] could not load the routes:', e instanceof Error ? e.message : e);
    }
    return out;
  })();
  routeCache.set(key, p);
  void p.then((m) => { if (!m.size) routeCache.delete(key); });
  return p;
}

/** Centres from the DPU centre API; the centres saved at login are used until it answers (or if it fails). */
function useReportCenters(): Center[] {
  const session = getSession();
  const saved = useCenters();
  const [dpu, setDpu] = useState<Center[]>([]);
  const vlccKey = session?.vlccIds.join(',') ?? '';
  const scope = session?.scope ?? '';
  useEffect(() => {
    const ids = [GLOBALS.stationid, vlccKey, session?.mccLoginId, session?.stationId]
      .map((x) => (x ?? '').trim())
      .filter((x, i, all) => x && all.indexOf(x) === i);
    const tries: CentreTry[] = ids.map((value) => ({ param: 'id' as const, value }));
    if (ids[0]) tries.push({ param: 'stationid', value: ids[0] });
    if (GLOBALS.userid) tries.push({ param: 'userid', value: GLOBALS.userid });
    if (session?.mccId) tries.push({ param: 'mccid', value: session.mccId });
    if (!tries.length) return;
    let alive = true;
    void loadReportCentres(`${scope}|${tries.map((t) => `${t.param}=${t.value}`).join('/')}`, tries).then((list) => { if (alive) setDpu(list); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, vlccKey]);
  const base = dpu.length ? dpu : saved;
  const [routeOf, setRouteOf] = useState<RouteOf>(new Map());
  const baseCount = base.length;
  useEffect(() => {
    const mccid = session?.mccLoginId || GLOBALS.mccLoginId || session?.mccId || GLOBALS.mccid || '';
    if (!mccid || !baseCount) return;
    let alive = true;
    void loadRouteMap(mccid, GLOBALS.plantid || '', baseCount).then((m) => { if (alive) setRouteOf(m); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, baseCount]);
  return useMemo(() => (routeOf.size ? base.map((c) => { const r = routeOf.get(c.id); return r ? { ...c, routeId: r.id, routeName: r.name } : c; }) : base), [base, routeOf]);
}

/**
 * The plant / route a centre belongs to. It comes from the centre API (route id, else route name), so a login with many
 * routes (Bansi) gets one Plant/MCC entry per route. Only when the API sends no route at all the first 3 digits of the
 * centre id are used, as before.
 */
export const plantKeyOf = (c: Center, fallback = ''): string => (c.routeId || c.routeName || c.id.slice(0, 3) || fallback).trim();

/** Dropdown text: "VILLAGE NAME | 7090810" (name and id together). */
export const centreLabel = (id: string, name?: string): string => (name && name.trim() && name.trim() !== id ? `${name.trim()} | ${id}` : id);

const toISO = (raw: string): string => {
  const s = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = isoFromTrdate(s);
  if (parsed) return parsed;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const apiMilk = (milk?: MilkKind | 'both') => milk === 'cow' ? 'C' as const : milk === 'buffalo' ? 'B' as const : milk === 'mix' ? 'M' as const : 'ALL' as const;
export const apiShift = (shift?: Shift | 'both') => shift === 'Morning' ? 'M' as const : shift === 'Evening' ? 'E' as const : 'Z' as const;
const smartKind = (kind: string | null): MilkKind => kind === 'cow' || kind === 'buffalo' ? kind : 'mix';
const smartShift = (shift: string | null): Shift => shift === 'Evening' ? 'Evening' : 'Morning';

const KIND_RANK: Record<string, number> = { cow: 0, buffalo: 1, mix: 2 };

/** Same order everywhere: date, Morning before Evening, milk type, farmer number, time. */
const rowOrder = (r: CollectionEntry): string => {
  const id = /^\d+$/.test(r.farmerId) ? String(Number(r.farmerId)).padStart(8, '0') : r.farmerId;
  return `${r.date}|${r.shift === 'Morning' ? 0 : 1}|${KIND_RANK[r.kind] ?? 3}|${id}|${time24(r.time)}`;
};

function useRawFarmerRows(filter: LiveFilter, keyPrefix: string, enabled: boolean, hideOld = true): { q: QueryState<RawFarmerRow>; rows: CollectionEntry[] } {
  const session = getSession();
  const centers = useReportCenters();
  const ids = filter.vlccId && filter.vlccId !== 'all' ? [filter.vlccId] : filter.vlccIds?.length ? filter.vlccIds : centers.length ? centers.map((c) => c.id) : session?.vlccIds ?? [];
  const idKey = ids.join(',');
  // a page that is not submitted yet (enabled = false) must not ask the server anything
  const queryKey = enabled && ids.length ? `${keyPrefix}:${filter.from}:${filter.to}:${filter.shift ?? 'both'}:${filter.milk ?? 'both'}:${idKey}` : null;
  const q = useQuery<RawFarmerRow>(queryKey, (emit, signal) => fetchFarmerCollection({
    from: filter.from,
    to: filter.to,
    shift: apiShift(filter.shift),
    milk: apiMilk(filter.milk),
    vlccIds: ids,
  }, emit, signal), { hideOldWhileLoading: hideOld });
  const names = useMemo(() => new Map(centers.map((c) => [c.id, c.name || c.label || c.id])), [centers]);
  const plantOf = useMemo(() => new Map(centers.map((c) => [c.id, plantKeyOf(c)])), [centers]);
  const rows = useMemo(() => {
    const used = new Map<string, number>();
    const list = mapFarmers(q.rows).map((r): CollectionEntry => {
      const date = toISO(r.date);
      const shift = smartShift(r.shift);
      const kind = smartKind(r.milk);
      // the row id must not depend on the position in the list: rows arrive in parts, and a changing id made every row redraw
      const base = `${r.vlccid}|${r.farmerId}|${date}|${shift}|${kind}|${r.sampleNo}|${r.time}|${r.liter}|${r.amount}`;
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      return {
        id: n ? `${base}#${n}` : base,
        stationId: r.vlccid,
        plant: plantOf.get(r.vlccid) || r.vlccid.slice(0, 3) || session?.mccId || '',
        date,
        time: r.time || '',
        shift,
        farmerId: r.farmerId,
        farmer: titleCase(r.farmerName),
        centre: titleCase(names.get(r.vlccid) || r.village || r.vlccid),
        kind,
        litres: r.liter,
        fat: r.fat,
        snf: r.snf,
        rate: r.rate,
        amount: r.amount,
        sampleNo: r.sampleNo,
        kg: r.kg,
        clr: r.clr,
        water: r.water,
        village: r.village,
        stationCode: r.stationCode || undefined,
        branchId: r.branchId || undefined,
      };
    });
    const keyed = list.map((r) => [rowOrder(r), r] as const);
    keyed.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    return keyed.map((x) => x[1]);
  }, [q.rows, names, plantOf, session?.mccId]);
  return { q, rows };
}

const NO_ROWS: never[] = [];

/** `hideOld` (default): after Submit the table shows the loader until the new data has arrived, never the earlier / saved rows. */
export function useMilkFarmerEntries(filter: LiveFilter, enabled = true, hideOld = true): LiveReportState<CollectionEntry> {
  const { q, rows } = useRawFarmerRows(filter, 'smartx-designed-farmer-report', enabled, hideOld);
  const session = getSession();
  // depends on the filter VALUES (not on the filter object, which is a new object on every render): the result list keeps the
  // same identity between renders, so clicking a dropdown or button does not recalculate / redraw the whole report
  const { from, to, shift, milk, vlccId } = filter;
  const filtered = useMemo(() => rows.filter((r) =>
    r.date >= from && r.date <= to &&
    (!shift || shift === 'both' || r.shift === shift) &&
    (!milk || milk === 'both' || r.kind === milk) &&
    (!vlccId || vlccId === 'all' || r.stationId === vlccId)
  ), [rows, from, to, shift, milk, vlccId]);
  const shown = enabled && session?.vlccIds?.length ? filtered : NO_ROWS;
  const busy = enabled && !!session?.vlccIds?.length && (q.status === 'loading' || q.fetching);
  return {
    rows: shown,
    // rows are shown as soon as the first answer arrives; the loader only covers the time before that
    loading: busy && shown.length === 0,
    fetching: busy,
    done: q.done,
    error: !session?.vlccIds?.length ? 'No centre IDs were returned by the login/session API.' : q.error?.message ?? null,
    retry: q.retry,
    updatedAt: q.updatedAt,
    failed: enabled ? q.failed : 0,
    total: q.total,
  };
}

export interface LiveVlccRow {
  key: string;
  vlccid: string;
  village: string;
  date: string;
  liter: number;
  kg: number;
  fat: number;
  snf: number;
  rate: number;
  amount: number;
  milk: MilkKind;
  shift: Shift;
}
export function useMilkVlccEntries(filter: LiveFilter, enabled = true): LiveReportState<LiveVlccRow> {
  const session = getSession();
  const centers = useReportCenters();
  const ids = filter.vlccId && filter.vlccId !== 'all' ? [filter.vlccId] : filter.vlccIds?.length ? filter.vlccIds : centers.length ? centers.map((c) => c.id) : session?.vlccIds ?? [];
  const idKey = ids.join(',');
  const key = enabled && ids.length ? `smartx-designed-vlcc-report:${filter.from}:${filter.to}:${filter.shift ?? 'both'}:${filter.milk ?? 'both'}:${idKey}` : null;
  const q = useQuery<RawVlccRow>(key, (emit) => fetchVlccCollection({
    from: filter.from, to: filter.to, shift: apiShift(filter.shift), milk: apiMilk(filter.milk), vlccIds: ids,
  }, emit), { hideOldWhileLoading: true });
  const names = useMemo(() => new Map(centers.map((c) => [c.id, c.name || c.label || c.id])), [centers]);
  const rows = useMemo(() => mapVlcc(q.rows).map((r): LiveVlccRow => ({
    key: r.key,
    vlccid: r.vlccid,
    village: r.village || names.get(r.vlccid) || r.vlccid,
    date: toISO(r.date),
    liter: r.liter,
    kg: r.kg,
    fat: r.fat,
    snf: r.snf,
    rate: r.rate,
    amount: r.amount,
    milk: smartKind(r.milk),
    shift: smartShift(r.shift),
  })), [q.rows, names]);
  const shown = enabled ? rows.filter((r) => r.date >= filter.from && r.date <= filter.to && (!filter.shift || filter.shift === 'both' || r.shift === filter.shift) && (!filter.milk || filter.milk === 'both' || r.milk === filter.milk) && (!filter.vlccId || filter.vlccId === 'all' || r.vlccid === filter.vlccId)) : [];
  const busy = enabled && ids.length > 0 && (q.status === 'loading' || q.fetching);
  return {
    rows: shown,
    loading: busy && shown.length === 0,
    fetching: busy,
    done: q.done,
    error: !session?.vlccIds?.length ? 'No centre IDs were returned by the login/session API.' : q.error?.message ?? null,
    retry: q.retry,
    updatedAt: q.updatedAt,
    failed: enabled ? q.failed : 0,
    total: q.total,
  };
}

export interface CentreOpt { id: string; name: string; mccId: string; plantName: string; label: string; /** the centre's own station code (0001 ...), when the centre API sends one */ code?: string }

export function useMilkCenterOptions(): CentreOpt[] {
  const centers = useReportCenters();
  const session = getSession();
  return useMemo(() => {
    const mcc = session?.mccId || '';
    // route name of every plant key (taken from the first centre of that route that has one)
    const routeNames = new Map<string, string>();
    for (const c of centers) {
      const key = plantKeyOf(c, mcc);
      if (c.routeName && !routeNames.has(key)) routeNames.set(key, c.routeName);
    }
    const plant = (m: string) => stripRoute(routeNames.get(m) || session?.mccName || m);
    const list = centers.length
      ? centers.map((c) => ({ id: c.id, name: c.name || c.label || '', mccId: plantKeyOf(c, mcc), code: c.stationId || session?.stationByVlcc?.[c.id] || undefined }))
      : (session?.vlccIds ?? []).map((id) => ({ id, name: session?.vlccNames?.[id] || '', mccId: id.slice(0, 3) || mcc, code: session?.stationByVlcc?.[id] || undefined }));
    // VLC dropdowns (every report, Farmer Master ...): "Name | ID" - the name (first letter of every word in capitals) and the
    // centre id exactly as the centre API (getCenter / FarmerCollectionDpu) sends them
    return list.map((c) => {
      const name = titleCase(c.name);
      const label = !name || name.toUpperCase() === c.id.toUpperCase() ? c.id : `${name} | ${c.id}`;
      return { ...c, plantName: plant(c.mccId), label };
    });
  }, [centers, session?.vlccIds, session?.vlccNames, session?.stationByVlcc, session?.mccId, session?.mccName]);
}

/** Plant/MCC dropdown: only the plant (route) name, e.g. "MAIN ROUTE" - no id, no "All". The value stays the MCC id. */
export function usePlantOptions(centres: CentreOpt[]): { value: string; label: string }[] {
  return useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of centres) if (!seen.has(c.mccId)) seen.set(c.mccId, c.plantName);
    return [...seen].map(([value, name]) => ({ value, label: titleCase(stripRoute(name || value)) }));
  }, [centres]);
}

/**
 * Plant -> VLC dropdowns of every report (without `withAll`: the first plant and its first centre are selected by default).
 * `plant` / `centre` are what the person picked ('' = nothing picked yet); the returned values are always a real option.
 * `withAll` (CDA Report, Farmer Collection) adds an "All" row (value 'all') on top of both dropdowns:
 * plant 'all' = every plant, centre 'all' = every centre of the picked plant(s). "All" is also the default selection.
 */
export function useReportScope(centres: CentreOpt[], plant: string, centre: string, withAll = false) {
  const realPlants = usePlantOptions(centres);
  const plantOptions = useMemo(
    () => (withAll && realPlants.length ? [{ value: ALL, label: 'All' }, ...realPlants] : realPlants),
    [withAll, realPlants],
  );
  const plantValue = plantOptions.some((o) => o.value === plant) ? plant : withAll && realPlants.length ? ALL : realPlants[0]?.value ?? '';
  const realCentres = useMemo(
    () => centres.filter((c) => plantValue === ALL || c.mccId === plantValue).map((c) => ({ value: c.id, label: c.label })),
    [centres, plantValue],
  );
  const centreOptions = useMemo(
    () => (withAll && realCentres.length ? [{ value: ALL, label: 'All' }, ...realCentres] : realCentres),
    [withAll, realCentres],
  );
  const centreValue = centreOptions.some((o) => o.value === centre) ? centre : withAll && realCentres.length ? ALL : realCentres[0]?.value ?? '';
  return { plantOptions, centreOptions, plant: plantValue, centre: centreValue };
}

/** value of the "All" row in the Plant / VLC dropdowns */
export const ALL = 'all';

/** centre ids a report has to ask for: one centre, or (All) every centre of the picked plant / of every plant */
export function centreIdsFor(centres: CentreOpt[], plant: string, centre: string): string[] {
  if (centre && centre !== ALL) return [centre];
  return centres.filter((c) => !plant || plant === ALL || c.mccId === plant).map((c) => c.id);
}

/* ---------- Farmer dropdown: DPU FarmerMaster (loads before Submit) ---------- */

const farmerCache = new Map<string, Promise<MasterFarmerOption[]>>();
const loadFarmers = (id: string): Promise<MasterFarmerOption[]> => {
  const hit = farmerCache.get(id);
  if (hit) return hit;
  const p = fetchDpuFarmerMaster(id).catch(() => [] as MasterFarmerOption[]);
  farmerCache.set(id, p);
  void p.then((l) => { if (!l.length) farmerCache.delete(id); });
  return p;
};
/** "0003" and "3" are the same farmer */
export const farmerKey = (vlccid: string, farmerId: string): string => `${vlccid}:${String(farmerId).trim().replace(/^0+(?=\d)/, '')}`;

export function useFarmerMasterOptions(vlccIds: string[], names: Record<string, string>): { options: { value: string; label: string }[]; loading: boolean } {
  const [list, setList] = useState<MasterFarmerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const key = vlccIds.join(',');
  useEffect(() => {
    let alive = true;
    setList([]);
    if (!vlccIds.length) { setLoading(false); return; }
    setLoading(true);
    void Promise.all(vlccIds.map(loadFarmers)).then((parts) => { if (alive) { setList(parts.flat()); setLoading(false); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const options = useMemo(() => {
    const multi = vlccIds.length > 1;
    const seen = new Set<string>();
    return list
      .map((f) => ({ value: farmerKey(f.vlccid, f.farmerId), label: `${f.farmerId} | ${f.name || 'No name'}${multi ? ` (${names[f.vlccid] || f.vlccid})` : ''}` }))
      .filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [list, names, vlccIds.length]);
  return { options, loading };
}
