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
import type { RawFarmerRow, RawVlccRow } from '../services/types/raw';

export interface LiveReportState<T> {
  rows: T[];
  loading: boolean;
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
  return dpu.length ? dpu : saved;
}

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
const apiMilk = (milk?: MilkKind | 'both') => milk === 'cow' ? 'C' as const : milk === 'buffalo' ? 'B' as const : milk === 'mix' ? 'M' as const : 'ALL' as const;
const apiShift = (shift?: Shift | 'both') => shift === 'Morning' ? 'M' as const : shift === 'Evening' ? 'E' as const : 'Z' as const;
const smartKind = (kind: string | null): MilkKind => kind === 'cow' || kind === 'buffalo' ? kind : 'mix';
const smartShift = (shift: string | null): Shift => shift === 'Evening' ? 'Evening' : 'Morning';

function useRawFarmerRows(filter: LiveFilter, keyPrefix: string): { q: QueryState<RawFarmerRow>; rows: CollectionEntry[] } {
  const session = getSession();
  const centers = useReportCenters();
  const ids = filter.vlccId && filter.vlccId !== 'all' ? [filter.vlccId] : centers.length ? centers.map((c) => c.id) : session?.vlccIds ?? [];
  const idKey = ids.join(',');
  const queryKey = ids.length ? `${keyPrefix}:${filter.from}:${filter.to}:${filter.shift ?? 'both'}:${filter.milk ?? 'both'}:${idKey}` : null;
  const q = useQuery<RawFarmerRow>(queryKey, (emit) => fetchFarmerCollection({
    from: filter.from,
    to: filter.to,
    shift: apiShift(filter.shift),
    milk: apiMilk(filter.milk),
    vlccIds: ids,
  }, emit));
  const names = useMemo(() => new Map(centers.map((c) => [c.id, c.name || c.label || c.id])), [centers]);
  const rows = useMemo(() => mapFarmers(q.rows).map((r, i): CollectionEntry => ({
    id: r.key || `${r.vlccid}:${r.farmerId}:${r.sampleNo}:${i}`,
    stationId: r.vlccid,
    plant: r.vlccid.slice(0, 3) || session?.mccId || '',
    date: toISO(r.date),
    time: r.time || '',
    shift: smartShift(r.shift),
    farmerId: r.farmerId,
    farmer: r.farmerName,
    centre: names.get(r.vlccid) || r.village || r.vlccid,
    kind: smartKind(r.milk),
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
  })), [q.rows, names, session?.mccId]);
  return { q, rows };
}

export function useMilkFarmerEntries(filter: LiveFilter, enabled = true): LiveReportState<CollectionEntry> {
  const { q, rows } = useRawFarmerRows(filter, 'smartx-designed-farmer-report');
  const session = getSession();
  const filtered = useMemo(() => rows.filter((r) =>
    r.date >= filter.from && r.date <= filter.to &&
    (!filter.shift || filter.shift === 'both' || r.shift === filter.shift) &&
    (!filter.milk || filter.milk === 'both' || r.kind === filter.milk) &&
    (!filter.vlccId || filter.vlccId === 'all' || r.stationId === filter.vlccId)
  ), [rows, filter]);
  return {
    rows: enabled && session?.vlccIds?.length ? filtered : [],
    loading: enabled && !!session?.vlccIds?.length && (q.status === 'loading' || q.fetching),
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
  const ids = filter.vlccId && filter.vlccId !== 'all' ? [filter.vlccId] : centers.length ? centers.map((c) => c.id) : session?.vlccIds ?? [];
  const idKey = ids.join(',');
  const key = enabled && ids.length ? `smartx-designed-vlcc-report:${filter.from}:${filter.to}:${filter.shift ?? 'both'}:${filter.milk ?? 'both'}:${idKey}` : null;
  const q = useQuery<RawVlccRow>(key, (emit) => fetchVlccCollection({
    from: filter.from, to: filter.to, shift: apiShift(filter.shift), milk: apiMilk(filter.milk), vlccIds: ids,
  }, emit));
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
  return {
    rows: enabled ? rows.filter((r) => r.date >= filter.from && r.date <= filter.to && (!filter.shift || filter.shift === 'both' || r.shift === filter.shift) && (!filter.milk || filter.milk === 'both' || r.milk === filter.milk) && (!filter.vlccId || filter.vlccId === 'all' || r.vlccid === filter.vlccId)) : [],
    loading: enabled && ids.length > 0 && (q.status === 'loading' || q.fetching),
    error: !session?.vlccIds?.length ? 'No centre IDs were returned by the login/session API.' : q.error?.message ?? null,
    retry: q.retry,
    updatedAt: q.updatedAt,
    failed: enabled ? q.failed : 0,
    total: q.total,
  };
}

export interface CentreOpt { id: string; name: string; mccId: string; plantName: string; label: string }

export function useMilkCenterOptions(): CentreOpt[] {
  const centers = useReportCenters();
  const session = getSession();
  return useMemo(() => {
    const mcc = session?.mccId || '';
    const routeOf = (prefix: string) => centers.find((c) => c.id.startsWith(prefix) && c.routeName)?.routeName || '';
    const plant = (m: string) => routeOf(m) || session?.mccName || m;
    const list = centers.length
      ? centers.map((c) => ({ id: c.id, name: c.name || c.label || '', mccId: c.id.slice(0, 3) || mcc }))
      : (session?.vlccIds ?? []).map((id) => ({ id, name: session?.vlccNames?.[id] || '', mccId: id.slice(0, 3) || mcc }));
    return list.map((c) => ({ ...c, plantName: plant(c.mccId), label: centreLabel(c.id, c.name) }));
  }, [centers, session?.vlccIds, session?.vlccNames, session?.mccId, session?.mccName]);
}

/** Plant/MCC dropdown: shows the plant (route) name, the value stays the MCC id. */
export function usePlantOptions(centres: CentreOpt[]): { value: string; label: string }[] {
  return useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of centres) if (!seen.has(c.mccId)) seen.set(c.mccId, c.plantName);
    return [{ value: 'all', label: 'All MCCs' }, ...[...seen].map(([value, name]) => ({ value, label: name && name !== value ? `${name} | ${value}` : value }))];
  }, [centres]);
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
