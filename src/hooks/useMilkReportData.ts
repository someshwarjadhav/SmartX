import { useMemo } from 'react';
import type { CollectionEntry, Shift } from '../data/farmerCollection';
import type { MilkKind } from '../types';
import { getSession } from '../services/session';
import { useQuery, type QueryState } from './useQuery';
import { fetchFarmerCollection } from '../services/farmer/farmer.api.ts';
import { fetchVlccCollection } from '../services/vlcc/vlcc.api.ts';
import { mapFarmers } from '../services/mappers/farmer.mapper.ts';
import { mapVlcc } from '../services/mappers/vlcc.mapper.ts';
import { useCenters } from './useSessionData';
import { isoFromTrdate } from '../services/utils/date';
import type { RawFarmerRow, RawVlccRow } from '../services/types/raw';

export interface LiveReportState<T> {
  rows: T[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  updatedAt: number | null;
}
export interface LiveFilter {
  from: string;
  to: string;
  shift?: Shift | 'both';
  milk?: MilkKind | 'both';
  vlccId?: string | 'all';
}
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
  const centers = useCenters();
  const ids = filter.vlccId && filter.vlccId !== 'all' ? [filter.vlccId] : session?.vlccIds ?? [];
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
  const centers = useCenters();
  const ids = filter.vlccId && filter.vlccId !== 'all' ? [filter.vlccId] : session?.vlccIds ?? [];
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
  };
}

export function useMilkCenterOptions() {
  const centers = useCenters();
  const session = getSession();
  return useMemo(() => centers.length ? centers.map((c) => ({ id: c.id, label: c.name || c.label || c.id, mccId: c.id.slice(0, 3) || session?.mccId || '' })) : (session?.vlccIds ?? []).map((id) => ({ id, label: session?.vlccNames?.[id] || id, mccId: id.slice(0, 3) || session?.mccId || '' })), [centers, session?.vlccIds, session?.vlccNames, session?.mccId]);
}
