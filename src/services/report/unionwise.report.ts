/** Unionwise Collection report: groups farmer rows by VLC / society. */
import type { FarmerRow } from '../mappers/farmer.mapper.ts';


export interface UnionRow {
  key: string;
  union: string;
  society: string;
  vlccid: string;
  farmers: number;
  liter: number;
  fat: number;
  snf: number;
  rate: number;
  amount: number;
}

export function unionwise(rows: FarmerRow[], unionOf: (vlccid: string) => string, societyOf: (vlccid: string) => string): UnionRow[] {
  const by = new Map<string, { farmers: Set<string>; liter: number; fw: number; sw: number; amount: number }>();
  for (const r of rows) {
    const b = by.get(r.vlccid) ?? { farmers: new Set<string>(), liter: 0, fw: 0, sw: 0, amount: 0 };
    b.farmers.add(r.farmerId);
    b.liter += r.liter;
    b.fw += r.liter * r.fat;
    b.sw += r.liter * r.snf;
    b.amount += r.amount;
    by.set(r.vlccid, b);
  }
  return [...by.entries()]
    .map(([vlccid, b]) => ({
      key: vlccid,
      union: unionOf(vlccid),
      society: societyOf(vlccid),
      vlccid,
      farmers: b.farmers.size,
      liter: b.liter,
      fat: b.liter ? b.fw / b.liter : 0,
      snf: b.liter ? b.sw / b.liter : 0,
      rate: b.liter ? b.amount / b.liter : 0,
      amount: b.amount,
    }))
    .sort((a, b) => a.union.localeCompare(b.union) || a.society.localeCompare(b.society));
}

export function unionTotals(rows: UnionRow[]) {
  let liter = 0, fw = 0, sw = 0, amount = 0, farmers = 0;
  for (const r of rows) {
    liter += r.liter;
    fw += r.liter * r.fat;
    sw += r.liter * r.snf;
    amount += r.amount;
    farmers += r.farmers;
  }
  return { societies: rows.length, farmers, liter, amount, fat: liter ? fw / liter : 0, snf: liter ? sw / liter : 0, rate: liter ? amount / liter : 0 };
}
