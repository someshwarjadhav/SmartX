import { STORAGE_PLAN, fyLabel } from '../../config/storagePlan';
import { getSession } from '../session';

/* ---------------- price quote ---------------- */

export interface QuoteLine {
  id: string;
  label: string;
  note: string;
  rate: number;
  qty: number;
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  total: number;
}

export const retentionYears = () =>
  STORAGE_PLAN.retention.map((r) => ({
    year: STORAGE_PLAN.renewalYear - r.back,
    label: fyLabel(STORAGE_PLAN.renewalYear - r.back),
    perStation: r.perStation,
  }));

/** Renewal x stations + every kept year x stations. */
export function quoteFor(stations: number, keepYears: number[]): Quote {
  const n = Math.max(0, stations);
  const lines: QuoteLine[] = [];
  if (n > 0) {
    lines.push({
      id: 'renewal',
      label: `Annual renewal ${fyLabel(STORAGE_PLAN.renewalYear)}`,
      note: 'Cloud storage for the new year',
      rate: STORAGE_PLAN.renewalPerStation,
      qty: n,
      amount: STORAGE_PLAN.renewalPerStation * n,
    });
    for (const r of retentionYears()) {
      if (!keepYears.includes(r.year)) continue;
      lines.push({
        id: `keep-${r.year}`,
        label: `Keep ${r.label} data`,
        note: 'Previous year data retained',
        rate: r.perStation,
        qty: n,
        amount: r.perStation * n,
      });
    }
  }
  return { lines, total: lines.reduce((a, l) => a + l.amount, 0) };
}

/* ---------------- rolling deletion ---------------- */

/** Data created on `iso` (yyyy-MM-dd) is removed exactly one year later (29 Feb -> 28 Feb). */
export function deletionDate(iso: string): string {
  const [y = 0, m = 1, d = 1] = iso.slice(0, 10).split('-').map(Number);
  const target = y + STORAGE_PLAN.deleteAfterYears;
  const last = new Date(target, m, 0).getDate();
  const day = Math.min(d, last);
  return `${target}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Whole days from today until `iso` (negative = already past). */
export function daysUntil(iso: string, today = new Date()): number {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86_400_000);
}

/** Today minus one year: data created before this day is already past its retention. */
export function cutoffDate(today = new Date()): string {
  const y = today.getFullYear() - STORAGE_PLAN.deleteAfterYears;
  const last = new Date(y, today.getMonth() + 1, 0).getDate();
  const day = Math.min(today.getDate(), last);
  return `${y}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* ---------------- saved preference ---------------- */

export interface StoragePreference {
  stationIds: string[];
  keepYears: number[];
  /** the customer wants a downloadable backup of the data that will be deleted */
  backup: boolean;
  total: number;
  savedAt: string;
  status: 'payment_pending';
}

/**
 * TODO(backend): the server has no endpoint for this yet. Until it has, the choice is kept in this browser only
 * (per login). Replace the three functions below with the real calls, e.g.
 *   GET  /home/storagepreference            -> load
 *   POST /home/storagepreference            -> save   (stationIds, keepYears, backup, total)
 *   POST /home/storagepreference/cancel     -> clear
 * The page needs no change: it only uses these three functions.
 */
const key = (): string => `smartx.storageplan.${getSession()?.scope ?? 'user'}`;

export async function loadPreference(): Promise<StoragePreference | null> {
  try {
    const raw = window.localStorage.getItem(key());
    return raw ? (JSON.parse(raw) as StoragePreference) : null;
  } catch {
    return null;
  }
}

export async function savePreference(
  p: Omit<StoragePreference, 'savedAt' | 'status'>,
): Promise<StoragePreference> {
  const full: StoragePreference = { ...p, savedAt: new Date().toISOString(), status: 'payment_pending' };
  window.localStorage.setItem(key(), JSON.stringify(full));
  return full;
}

export async function clearPreference(): Promise<void> {
  try {
    window.localStorage.removeItem(key());
  } catch {
    /* ignore */
  }
}
