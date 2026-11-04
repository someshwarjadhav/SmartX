/** VLC Status report: which VLCs delivered milk, with totals and the last delivery date. */
import type { VlccRow } from '../mappers/vlcc.mapper.ts';
import { isoFromTrdate } from '../utils/date';


export interface StatusRow { vlccid: string; village: string; active: boolean; liter: number; fat: number; snf: number; lastDate: string }

export function vlcStatus(ids: string[], rows: VlccRow[], villageOf: (id: string) => string): StatusRow[] {
  const by = new Map<string, { liter: number; fw: number; sw: number; last: string; lastIso: string }>();
  for (const r of rows) {
    const b = by.get(r.vlccid) ?? { liter: 0, fw: 0, sw: 0, last: '', lastIso: '' };
    b.liter += r.liter;
    b.fw += r.liter * r.fat;
    b.sw += r.liter * r.snf;
    const iso = isoFromTrdate(r.date) ?? r.date;
    if (r.liter > 0 && iso >= b.lastIso) { b.lastIso = iso; b.last = r.date; }
    by.set(r.vlccid, b);
  }
  return ids.map((id) => {
    const b = by.get(id);
    return {
      vlccid: id,
      village: villageOf(id),
      active: !!b && b.liter > 0,
      liter: b?.liter ?? 0,
      fat: b && b.liter ? b.fw / b.liter : 0,
      snf: b && b.liter ? b.sw / b.liter : 0,
      lastDate: b?.last ?? '',
    };
  });
}
