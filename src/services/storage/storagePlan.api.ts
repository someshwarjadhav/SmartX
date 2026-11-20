import {
  CUSTOM_ADDONS,
  PLAN_INCLUDED,
  PLAN_TIERS,
  STORAGE_PLAN,
  customSurchargePct,
  fyLabel,
  planPrices,
  type PlanId,
} from '../../config/storagePlan';
import { getSession } from '../session';


export interface QuoteLine {
  id: string;
  label: string;
  note: string;
  rate: number;
  qty: number;
  /** what `qty` counts: shows as "Rs rate x qty unit" */
  unit: 'Station ID' | 'plan' | 'item';
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  total: number;
}

export interface QuoteOptions {
  /** the software plan chosen; null/undefined = only renewing cloud storage */
  planId?: PlanId | null;
  /** ids from CUSTOM_ADDONS */
  customIds?: string[];
  /** custom work quoted separately (Rs) */
  customAmount?: number;
}

export const retentionYears = () =>
  STORAGE_PLAN.retention.map((r) => ({
    year: STORAGE_PLAN.renewalYear - r.back,
    label: fyLabel(STORAGE_PLAN.renewalYear - r.back),
    perStation: r.perStation,
  }));


export function customSubtotal(customIds: string[] = [], customAmount = 0): number {
  const ticked = CUSTOM_ADDONS.filter((a) => customIds.includes(a.id)).reduce((a, x) => a + x.price, 0);
  return ticked + Math.max(0, Math.round(customAmount) || 0);
}


export function quoteFor(stations: number, keepYears: number[], opts: QuoteOptions = {}): Quote {
  const n = Math.max(0, stations);
  const lines: QuoteLine[] = [];
  if (n > 0) {
    const tierIdx = PLAN_TIERS.findIndex((t) => t.id === opts.planId);
    const tier = tierIdx >= 0 ? PLAN_TIERS[tierIdx] : undefined;
    if (tier) {
      const price = planPrices()[tierIdx] ?? 0;
      lines.push({
        id: 'plan',
        label: `${tier.name} plan`,
        note: `${tier.tagline} · ${PLAN_INCLUDED.stations} Station IDs + ${PLAN_INCLUDED.users} Users included`,
        rate: price,
        qty: 1,
        unit: 'plan',
        amount: price,
      });
    }
    const free = tier ? PLAN_INCLUDED.stations : 0;
    const billable = Math.max(0, n - free);
    if (billable > 0) {
      lines.push({
        id: 'renewal',
        label: `Annual renewal ${fyLabel(STORAGE_PLAN.renewalYear)}`,
        note: tier ? `Station IDs above the ${free} included` : 'Cloud storage for the new year',
        rate: STORAGE_PLAN.renewalPerStation,
        qty: billable,
        unit: 'Station ID',
        amount: STORAGE_PLAN.renewalPerStation * billable,
      });
    }
    for (const r of retentionYears()) {
      if (!keepYears.includes(r.year)) continue;
      lines.push({
        id: `keep-${r.year}`,
        label: `Keep ${r.label} data`,
        note: 'Previous year data retained',
        rate: r.perStation,
        qty: n,
        unit: 'Station ID',
        amount: r.perStation * n,
      });
    }
    const ids = opts.customIds ?? [];
    for (const a of CUSTOM_ADDONS) {
      if (!ids.includes(a.id)) continue;
      lines.push({ id: `custom-${a.id}`, label: a.label, note: 'Customisation', rate: a.price, qty: 1, unit: 'item', amount: a.price });
    }
    const work = Math.max(0, Math.round(opts.customAmount ?? 0) || 0);
    if (work > 0) {
      lines.push({ id: 'custom-work', label: 'Custom work (as quoted)', note: 'Your own requirement', rate: work, qty: 1, unit: 'item', amount: work });
    }
    const sub = customSubtotal(ids, work);
    const pct = customSurchargePct(sub);
    if (pct > 0) {
      const amount = Math.round((sub * pct) / 100);
      lines.push({
        id: 'custom-surcharge',
        label: `Customisation charge +${pct}%`,
        note: `On ₹${sub.toLocaleString('en-IN')} of customisation`,
        rate: amount,
        qty: 1,
        unit: 'item',
        amount,
      });
    }
  }
  return { lines, total: lines.reduce((a, l) => a + l.amount, 0) };
}


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
  /** software plan chosen (absent / null = only storage renewal) */
  planId?: PlanId | null;
  /** ticked customisations (ids of CUSTOM_ADDONS) */
  customIds?: string[];
  /** what the customer wants customised, in his words */
  customNote?: string;
  /** custom work quoted separately (Rs) */
  customAmount?: number;
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

/* ---------------- plan expiry (drives the "plan expired" popup) ---------------- */

export interface ActivePlan {
  planId: PlanId | null;
  expiresOn: string;
}


export async function loadActivePlan(): Promise<ActivePlan | null> {
  const d = STORAGE_PLAN.expiryDate as string;
  return d ? { planId: null, expiresOn: d } : null;
}

export type PlanState = 'ok' | 'soon' | 'expired';

export function planState(expiresOn: string, today = new Date()): { state: PlanState; days: number } {
  const days = daysUntil(expiresOn, today);
  if (days < 0) return { state: 'expired', days };
  if (days <= STORAGE_PLAN.warnDaysBefore) return { state: 'soon', days };
  return { state: 'ok', days };
}
