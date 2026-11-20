/**
 * Storage Plan (cloud storage renewal + software plans): every price, hike and limit lives here, so next year
 * only this file changes.
 *
 * Rule of the notice sent to customers:
 *   - Annual renewal ............ Rs 1250 per Station ID (for `renewalYear`)
 *   - Keep previous year data ... Rs 750 per Station ID per year (last year), Rs 450 (the year before)
 *   - Not kept .................. deleted exactly one year after the data was created (rolling deletion)
 *
 * Software plans (first registration): Regular -> Pro -> Pro+ -> Advance. Each plan costs a fixed % more than the
 * one before it (see `PLAN_HIKES`). Every plan includes 5 Station IDs and 5 Users (1 user = 1 Station ID).
 */
export const STORAGE_PLAN = {
  /** financial year the renewal is for: 2026 = 2026-27 */
  renewalYear: 2026,
  renewalPerStation: 1250,
  /** years of old data that can be kept: `back` = how many years before renewalYear */
  retention: [
    { back: 1, perStation: 750 },
    { back: 2, perStation: 450 },
  ],
  /** last day to confirm, yyyy-MM-dd. Leave '' until the date is decided: the page then shows no date */
  renewalDate: '',
  /**
   * Day the current plan ends, yyyy-MM-dd. Once this day is near or past, a popup sends the customer to the
   * Storage Plan page. Leave '' to switch the popup off. (When the server starts sending a per-customer expiry,
   * it wins over this value: see `loadActivePlan` in services/storage/storagePlan.api.ts.)
   */
  expiryDate: '',
  /** the popup starts this many days before the expiry day */
  warnDaysBefore: 7,
  /** how long un-kept data stays on the server */
  deleteAfterYears: 1,
} as const;

/** 2026 -> "2026-27" */
export const fyLabel = (y: number): string => `${y}-${String(y + 1).slice(-2)}`;

/* ------------------------------------------------------------------ */
/* Software plans                                                      */
/* ------------------------------------------------------------------ */

/** Included with EVERY plan, every time: 5 Station IDs and 5 Users (one user per Station ID). */
export const PLAN_INCLUDED = { stations: 5, users: 5 } as const;

/** First registration price of the lowest plan (Rs). */
export const PLAN_BASE_PRICE = 5000;

/**
 * Step-wise hike: each plan costs this many % more than the plan before it.
 *   Regular 5,000  ->  Pro +60% = 8,000  ->  Pro+ +40% = 11,200  ->  Advance +40% = 15,680
 * Change a number here and every price on the page follows.
 */
export const PLAN_HIKES = [0, 60, 40, 40] as const;

export type PlanId = 'regular' | 'pro' | 'proplus' | 'advance';

export interface PlanFeature {
  id: string;
  label: string;
  /** which group of the software it belongs to */
  group: 'Collection' | 'Billing' | 'Deductions & Accounts' | 'Advance & Control' | 'Advance modules';
  /** first plan (index in PLAN_TIERS) that has it; every higher plan has it too */
  from: 0 | 1 | 2 | 3;
  /**
   * Advance-only modules: NOT included automatically. The customer ticks the ones he needs (only with the Advance
   * plan) and `price` is added to the quote.
   */
  module?: boolean;
  price?: number;
}

export const PLAN_FEATURES: readonly PlanFeature[] = [
  /* Regular: collection only */
  { id: 'dashboard', label: 'Dashboard & live collection', group: 'Collection', from: 0 },
  { id: 'collection-reports', label: 'Collection reports (farmer, VLC, union, variance)', group: 'Collection', from: 0 },
  { id: 'collection-export', label: 'Excel / PDF / CSV export of collection', group: 'Collection', from: 0 },
  /* Pro: + billing and rate chart */
  { id: 'farmer-bill', label: 'Farmer bill & bill print', group: 'Billing', from: 1 },
  { id: 'payment-summary', label: 'Bank & cash payment summary', group: 'Billing', from: 1 },
  { id: 'vlc-bill', label: 'VLC milk bill', group: 'Billing', from: 1 },
  { id: 'rates', label: 'Rate chart, Excel rate upload & rate status', group: 'Billing', from: 1 },
  /* Pro+: + cattle feed bill, auto collection, deductions, accounts & manual entries */
  { id: 'cattle-feed-bill', label: 'Cattle feed bill', group: 'Billing', from: 2 },
  { id: 'auto-collection', label: 'Auto collection (VLC & Farmer)', group: 'Collection', from: 2 },
  { id: 'deductions', label: 'Standard, VLC & entry-wise deductions (Cattle feed & recovery)', group: 'Deductions & Accounts', from: 2 },
  { id: 'vouchers', label: 'Payment & receipt vouchers, account ledger', group: 'Deductions & Accounts', from: 2 },
  { id: 'entries', label: 'Manual milk entry, sale entry & manage collection', group: 'Advance & Control', from: 2 },
  /* Advance: everything in Pro+ and the customer picks the extra modules he needs */
  { id: 'support', label: 'Priority support & data backup', group: 'Advance modules', from: 3, module: true, price: 4000 },
];

/** the Advance-only modules the customer can pick */
export const ADVANCE_MODULES = PLAN_FEATURES.filter((f) => f.module);

export interface PlanTier {
  id: PlanId;
  name: string;
  /** one line shown under the name */
  tagline: string;
  /** what this plan adds on top of the one before it */
  adds: string;
  /** shown as a ribbon on the card */
  ribbon?: string;
}

export const PLAN_TIERS: readonly PlanTier[] = [
  { id: 'regular', name: 'Regular', tagline: 'Collection only', adds: 'Collection dashboard & reports' },
  { id: 'pro', name: 'Pro', tagline: 'Collection + Billing + Rate chart', adds: 'Farmer bill, payment summaries, VLC bill, rate chart' },
  {
    id: 'proplus',
    name: 'Pro+',
    tagline: 'Auto collection, Cattle feed bill, Deductions',
    adds: 'cattle feed bill, auto collection, deductions, vouchers & manual entries',
    ribbon: 'Most popular',
  },
  {
    id: 'advance',
    name: 'Advance',
    tagline: 'Pro+ and you choose the rest',
    adds: 'extra modules of your choice (priority support & data backup)',
    ribbon: 'Best value',
  },
];

/** price of every plan, in order: round(previous price x (1 + hike %)) */
export function planPrices(): number[] {
  const out: number[] = [];
  PLAN_TIERS.forEach((_, i) => {
    out.push(i === 0 ? PLAN_BASE_PRICE : Math.round(out[i - 1]! * (1 + (PLAN_HIKES[i] ?? 0) / 100)));
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Customisation                                                       */
/* ------------------------------------------------------------------ */

export interface CustomAddon {
  id: string;
  label: string;
  note: string;
  price: number;
}

/** Ready-made customisations. The customer ticks what he needs and the amount is added. */
export const CUSTOM_ADDONS: readonly CustomAddon[] = [
  { id: 'report', label: 'Custom report / Excel format', note: 'Your own columns, titles and layout', price: 3000 },
  { id: 'print', label: 'Custom bill & receipt print', note: 'Your logo, wording and paper size', price: 2000 },
  { id: 'alerts', label: 'WhatsApp / SMS alerts to farmers', note: 'Collection and bill messages', price: 4000 },
  { id: 'app', label: 'Own-branded mobile app', note: 'Your name and logo on the app', price: 5000 },
  { id: 'integration', label: 'Tally / ERP / bank integration', note: 'Data sent to your accounts software', price: 6000 },
];

/**
 * The bigger the customisation, the higher the rate: the surcharge % is picked by the total of everything
 * customised (ticked items + custom work). Slabs are checked top to bottom, first match wins.
 */
export const CUSTOM_SLABS: readonly { upTo: number; surchargePct: number }[] = [
  { upTo: 10000, surchargePct: 0 },
  { upTo: 15000, surchargePct: 10 },
  { upTo: 20000, surchargePct: 20 },
  { upTo: Number.POSITIVE_INFINITY, surchargePct: 30 },
];

export const customSurchargePct = (customTotal: number): number =>
  customTotal <= 0 ? 0 : (CUSTOM_SLABS.find((s) => customTotal <= s.upTo)?.surchargePct ?? 0);
