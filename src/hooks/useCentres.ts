import { useSyncExternalStore } from 'react';
import { useCenters } from './useSessionData';
import { getSession } from '../services/session';
import { vlccName } from '../services/vlcc/names';
import { titleCase, stripRoute } from '../lib/titleCase';

export interface CentreOption {
  id: string;
  label: string;
  /** "Name | centre id" (the real id, not the custom station id) - the Bansi payment Excel reads its centre code from this text */
  plainLabel: string;
}

export interface MccOption {
  id: string;
  label: string;
}

let selectedMcc = '';
const listeners = new Set<() => void>();

export function setSelectedMcc(id: string) {
  if (id === selectedMcc) return;
  selectedMcc = id;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const ALL_CENTRES = 'ALL';

// "Name | custom station id": the name (first letter of every word in capitals) and the custom station id from the APIs.
// The option id (value) stays the real centre id, so the data is fetched exactly as before; no custom id -> the real id is shown.
const centreLabel = (id: string, name: string, station?: string): string => {
  const n = titleCase(name);
  const shown = (station && station !== id ? station : '') || id;
  return n && n.toUpperCase() !== shown.toUpperCase() ? `${n} | ${shown}` : shown;
};

const allCentres = (centers: ReturnType<typeof useCenters>): CentreOption[] => {
  const s = getSession();
  if (centers.length) return centers.map((c) => ({ id: c.id, label: centreLabel(c.id, c.name || vlccName(c.id), s?.stationByVlcc[c.id] || c.stationId), plainLabel: centreLabel(c.id, c.name || vlccName(c.id)) }));
  return (s?.vlccIds ?? []).map((id) => ({ id, label: centreLabel(id, vlccName(id), s?.stationByVlcc[id]), plainLabel: centreLabel(id, vlccName(id)) }));
};

export function useMccOptions(): MccOption[] {
  const centers = useCenters();
  const s = getSession();
  const prefixes = [...new Set(allCentres(centers).map((c) => c.id.slice(0, 3)))];
  const own = s?.mccId ?? '';
  const list = prefixes.length ? prefixes : own ? [own] : [];
  return list.map((id) => {
    const route = centers.find((c) => c.id.startsWith(id) && c.routeName)?.routeName;
    return { id, label: stripRoute(route || s?.mccName || id) };
  });
}

export function useSelectedMcc(): string {
  const options = useMccOptions();
  const picked = useSyncExternalStore(subscribe, () => selectedMcc);
  return options.some((o) => o.id === picked) ? picked : options[0]?.id ?? '';
}

export function useCentreOptions(): CentreOption[] {
  const centers = useCenters();
  const mcc = useSelectedMcc();
  const all = allCentres(centers);
  const own = all.filter((c) => c.id.startsWith(mcc));
  return own.length ? own : all;
}

export const useFirstCentre = (): string => useCentreOptions()[0]?.id ?? '';

export const useCentreIds = (): string[] => useCentreOptions().map((c) => c.id);