import type { CollectionEntry } from '../data/farmerCollection';
import { GLOBALS } from './portal/global';

/**
 * Bansi's "All" Excel (All 11-10-26_20-10-26.xlsx):
 * the Bansi Dairy Nagpur login (user id 307 on the live STIPL server: userReportConfig?userid=307) gets this sheet from
 * "New Excel Export" when the VLC dropdown is on All. Every other login / selection keeps the normal New Excel Export
 * (this file is not used for them).
 */
export const BANSI_USER_IDS: string[] = ['307'];

export const isBansiAll = (centre: string): boolean => centre === 'all' && BANSI_USER_IDS.includes(String(GLOBALS.userid ?? '').trim());

const r2 = (n: number): number => Math.round(n * 100) / 100;
const r1 = (n: number): number => Math.round(n * 10) / 10;
const dmy = (iso: string): string => {
  const [y = '', m = '', d = ''] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
};
const dmyFile = (iso: string): string => dmy(iso).replace(/\//g, '-');

interface Acc { litres: number; cow: number; buf: number; kgFat: number; kgSnf: number; amount: number; clr: number; kg: number; kgGuess: number }
const blank = (): Acc => ({ litres: 0, cow: 0, buf: 0, kgFat: 0, kgSnf: 0, amount: 0, clr: 0, kg: 0, kgGuess: 0 });

function add(a: Acc, r: CollectionEntry): void {
  a.litres += r.litres;
  if (r.kind === 'cow') a.cow += r.litres;
  else if (r.kind === 'buffalo') a.buf += r.litres;
  a.kgFat += (r.litres * r.fat) / 100;
  a.kgSnf += (r.litres * r.snf) / 100;
  a.amount += r.amount;
  a.clr += r.litres * (r.clr ?? 0);
  a.kg += r.kg ?? 0;
  a.kgGuess += r.litres * 1.03;
}

/** one sheet row: Cow, Buffalo, Total Liter, FAT, SNF, Rate, Amount, Pay Amount, Degree, Quantity In KG, Kg Fat, Kg SNF */
function figures(a: Acc): number[] {
  const l = a.litres;
  return [
    r2(a.cow), r2(a.buf), r2(l),
    l ? r1((a.kgFat / l) * 100) : 0,
    l ? r1((a.kgSnf / l) * 100) : 0,
    l ? r2(a.amount / l) : 0,
    r2(a.amount), r2(a.amount),
    l ? r1(a.clr / l) : 0,
    r2(a.kg > 0 ? a.kg : a.kgGuess),
    r2(a.kgFat), r2(a.kgSnf),
  ];
}

const HEAD = ['Sr No', 'Farmer Name', 'Cow', 'Buffalo', 'Total Liter', 'FAT', 'SNF', 'Rate', 'Amount', 'Pay Amount', 'Degree', 'Quantity In KG', 'Kg Fat', 'Kg SNF'];
const idNum = (id: string): number => (/^\d+$/.test(id) ? Number(id) : Number.MAX_SAFE_INTEGER);

export async function exportBansiAllExcel(rows: CollectionEntry[], from: string, to: string, nameOf: (id: string) => string): Promise<void> {
  const XLSX = await import('xlsx');
  const byVlc = new Map<string, CollectionEntry[]>();
  for (const r of rows) {
    const list = byVlc.get(r.stationId);
    if (list) list.push(r); else byVlc.set(r.stationId, [r]);
  }
  const grand = blank();
  const aoa: Array<Array<string | number>> = [
    [],
    ['', 'From Date', dmy(from), 'To Date', dmy(to)],
    HEAD,
  ];
  [...byVlc.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach((vlc, i) => {
    aoa.push(['VSP Name']);
    const byFarmer = new Map<string, { name: string; acc: Acc }>();
    const total = blank();
    for (const r of byVlc.get(vlc)!) {
      const f = byFarmer.get(r.farmerId) ?? { name: r.farmer, acc: blank() };
      if (!f.name && r.farmer) f.name = r.farmer;
      add(f.acc, r);
      add(total, r);
      add(grand, r);
      byFarmer.set(r.farmerId, f);
    }
    [...byFarmer.entries()]
      .sort((a, b) => idNum(a[0]) - idNum(b[0]) || a[0].localeCompare(b[0]))
      .forEach(([, f], n) => aoa.push([n + 1, f.name, ...figures(f.acc)]));
    // the centre's own total row: "1. 500381 - Barbadi - BARBADI -Ward ..."
    const name = nameOf(vlc);
    aoa.push(['', `${i + 1}. ${vlc}${name && name !== vlc ? ` - ${name}` : ''}`, ...figures(total)]);
  });
  aoa.push([]);
  aoa.push(['', 'Total :', ...figures(grand)]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 7 }, { wch: 40 }, ...Array.from({ length: 12 }, () => ({ wch: 13 }))];
  // number cells show two decimals; Sr No stays a whole number
  aoa.forEach((row, r) => row.forEach((v, c) => {
    if (typeof v === 'number' && c >= 2) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = c === 5 || c === 6 || c === 10 ? '0.0' : '#,##0.00';
    }
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `All ${dmyFile(from)}_${dmyFile(to)}.xlsx`);
}
