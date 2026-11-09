import type { CollectionEntry } from '../../data/farmerCollection';
import { excelFileName } from './fileName';
import { GLOBALS } from '../../lib/portal/global';
import { getSession } from '../../services/session';
import { loadXlsx } from './exporters';

/**
 * Bansi's Farmer Collection sheet (All 11-10-26_20-10-26.xlsx):
 *   row 2  From Date / To Date
 *   row 3  Sr No | Farmer Name | Cow | Buffalo | Total Liter | FAT | SNF | Rate | Amount | Pay Amount | Degree | Quantity In KG | Kg Fat | Kg SNF
 *   per centre: a "VSP Name" row, its farmers, then the centre's own (bold) total row  "1. 500381 - Barbadi ..."
 *   last row: the bold grand "Total :" row
 * Only the Bansi Dairy Nagpur login (user id 307 on the live STIPL server: userReportConfig?userid=307) gets this layout,
 * on the Farmer Collection page (the table on screen and "New Excel Export"). Every other login keeps the normal report.
 */
// 307 = Bansi on the live STIPL server, 259 = the same Bansi Dairy Nagpur login on the DPU server
export const BANSI_USER_IDS: string[] = ['307', '259'];
const BANSI_MCC_LOGIN_IDS: string[] = ['183'];
/** The Bansi layout is only for these logins. Other logins that share Bansi's user id / MCC (for example the LogicShell
 *  login, which is a copy of the Bansi record) are NOT Bansi and keep the normal layout. */
export const BANSI_LOGIN_EMAILS: string[] = ['bansidairynagpur@gmail.com'];

/**
 * static condition: only the Bansi Dairy Nagpur login.
 *   - user id 307 (live STIPL server) is Bansi's own id
 *   - user id 259 / MCC 183 (DPU server) is shared with copies of the Bansi record, so the login e-mail must be Bansi's
 */
export const isBansiUser = (): boolean => {
  const userId = String(GLOBALS.userid ?? '').trim();
  if (userId === '307') return true;
  const sharedRecord = BANSI_USER_IDS.includes(userId) || BANSI_MCC_LOGIN_IDS.includes(String(GLOBALS.mccLoginId ?? '').trim());
  if (!sharedRecord) return false;
  return BANSI_LOGIN_EMAILS.includes((getSession()?.scope ?? '').trim().toLowerCase());
};

/** kept for older callers: Bansi login + VLC "All" */
export const isBansiAll = (centre: string): boolean => centre === 'all' && isBansiUser();

const r2 = (n: number): number => Math.round(n * 100) / 100;
const r1 = (n: number): number => Math.round(n * 10) / 10;
export const bansiDmy = (iso: string): string => {
  const [y = '', m = '', d = ''] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
};
const dmyFile = (iso: string): string => bansiDmy(iso).replace(/\//g, '-');

interface Acc { litres: number; cow: number; buf: number; kgFat: number; kgSnf: number; amount: number; clr: number; kg: number }
const blank = (): Acc => ({ litres: 0, cow: 0, buf: 0, kgFat: 0, kgSnf: 0, amount: 0, clr: 0, kg: 0 });

function add(a: Acc, r: CollectionEntry): void {
  a.litres += r.litres;
  if (r.kind === 'cow') a.cow += r.litres;
  else if (r.kind === 'buffalo') a.buf += r.litres;
  a.kgFat += (r.litres * r.fat) / 100;
  a.kgSnf += (r.litres * r.snf) / 100;
  a.amount += r.amount;
  a.clr += r.litres * (r.clr ?? 0);
  // Quantity In KG: the entry's own Kg when the server sends it, else litres x density (1 + CLR / 1000)
  a.kg += r.kg && r.kg > 0 ? r.kg : r.litres * (1 + ((r.clr ?? 0) > 0 ? (r.clr ?? 0) : 30) / 1000);
}

/** the 12 numbers of one sheet row: Cow, Buffalo, Total Liter, FAT, SNF, Rate, Amount, Pay Amount, Degree, Quantity In KG, Kg Fat, Kg SNF */
function figures(a: Acc): number[] {
  const l = a.litres;
  return [
    r2(a.cow), r2(a.buf), r2(l),
    l ? r1((a.kgFat / l) * 100) : 0,
    l ? r1((a.kgSnf / l) * 100) : 0,
    l ? r2(a.amount / l) : 0,
    r2(a.amount), r2(a.amount),
    l ? r1(a.clr / l) : 0,
    r2(a.kg),
    r2(a.kgFat), r2(a.kgSnf),
  ];
}

export const BANSI_HEAD = ['Sr No', 'Farmer Name', 'Cow', 'Buffalo', 'Total Liter', 'FAT', 'SNF', 'Rate', 'Amount', 'Pay Amount', 'Degree', 'Quantity In KG', 'Kg Fat', 'Kg SNF'];
/** decimals shown per figure column (index 0 = Cow ... 11 = Kg SNF): FAT, SNF and Degree show one decimal */
export const BANSI_DECIMALS = [2, 2, 2, 1, 1, 2, 2, 2, 1, 2, 2, 2];

export type BansiLine =
  | { kind: 'vsp'; key: string }
  | { kind: 'farmer'; key: string; sr: number; name: string; v: number[] }
  | { kind: 'centre'; key: string; text: string; v: number[] }
  | { kind: 'total'; key: string; text: string; v: number[] };

export interface BansiSheet {
  from: string;
  to: string;
  lines: BansiLine[];
}

const idNum = (id: string): number => (/^\d+$/.test(id) ? Number(id) : Number.MAX_SAFE_INTEGER);

const codeNum = (code: string | undefined): number => {
  const t = (code ?? '').trim();
  const n = /^\d+$/.test(t) ? Number(t) : NaN;
  // a station code is a small number (0001 ... 0032); a long number is an id, not the running number
  return Number.isFinite(n) && n > 0 && n < 10000 ? n : NaN;
};

/**
 * Same sheet as the STIPL "All" report: centres in station-code order (1, 2, 3 ...), every centre = "VSP Name" row, its farmers,
 * then its own total row "<no>. <station id> - <village>", and one grand "Total :" row at the end.
 * `codeOf` = the centre's station code from the centre API (0001 ...).
 */
export function buildBansiSheet(rows: CollectionEntry[], from: string, to: string, nameOf: (id: string) => string, codeOf: (id: string) => string = () => ''): BansiSheet {
  const byVlc = new Map<string, CollectionEntry[]>();
  for (const r of rows) {
    const list = byVlc.get(r.stationId);
    if (list) list.push(r); else byVlc.set(r.stationId, [r]);
  }
  const serialFor = (vlc: string, mine: CollectionEntry[]): number => {
    const own = codeNum(codeOf(vlc));
    if (Number.isFinite(own)) return own;
    const fromRows = codeNum(mine.find((r) => codeNum(r.stationCode) > 0)?.stationCode);
    return Number.isFinite(fromRows) ? fromRows : Number.MAX_SAFE_INTEGER;
  };
  const order = [...byVlc.keys()].sort((a, b) => serialFor(a, byVlc.get(a)!) - serialFor(b, byVlc.get(b)!) || a.localeCompare(b, undefined, { numeric: true }));
  const grand = blank();
  const lines: BansiLine[] = [];
  order.forEach((vlc, i) => {
    const mine = byVlc.get(vlc)!;
    lines.push({ kind: 'vsp', key: `vsp|${vlc}` });
    const byFarmer = new Map<string, { name: string; acc: Acc }>();
    const total = blank();
    for (const r of mine) {
      const f = byFarmer.get(r.farmerId) ?? { name: r.farmer, acc: blank() };
      if (!f.name && r.farmer) f.name = r.farmer;
      add(f.acc, r);
      add(total, r);
      add(grand, r);
      byFarmer.set(r.farmerId, f);
    }
    [...byFarmer.entries()]
      .sort((a, b) => idNum(a[0]) - idNum(b[0]) || a[0].localeCompare(b[0]))
      .forEach(([id, f], n) => lines.push({ kind: 'farmer', key: `f|${vlc}|${id}`, sr: n + 1, name: f.name, v: figures(f.acc) }));
    const serial = serialFor(vlc, mine);
    const rowCode = mine.find((r) => r.stationCode && r.stationCode.trim())?.stationCode?.trim();
    const station = rowCode || codeOf(vlc) || vlc;
    const place = mine.find((r) => r.village && r.village.trim())?.village?.trim() || nameOf(vlc);
    lines.push({ kind: 'centre', key: `c|${vlc}`, text: `${Number.isFinite(serial) && serial < Number.MAX_SAFE_INTEGER ? serial : i + 1}. ${station}${place && place !== station ? ` - ${place}` : ''}`, v: figures(total) });
  });
  lines.push({ kind: 'total', key: 'total', text: 'Total :', v: figures(grand) });
  return { from, to, lines };
}

/** file name: "All 11-10-26_20-10-26" or "500381 11-10-26_20-10-26" */
export const bansiFileName = (scope: string, from: string, to: string): string => `${scope} ${dmyFile(from)}_${dmyFile(to)}`;

// like the STIPL sheet: the name column has a fixed width (a long centre text is cut by the next cell), the others fit their numbers
const COL_WIDTHS = [6, 36, 11, 11, 13, 7, 7, 9, 13, 13, 8, 16, 11, 11];

export async function exportBansiSheet(sheet: BansiSheet, fileScope: string): Promise<void> {
  const XLSX = await loadXlsx();
  const NCOL = BANSI_HEAD.length;
  const pad = (row: Array<string | number>): Array<string | number> => [...row, ...Array.from({ length: Math.max(0, NCOL - row.length) }, () => '')];
  const aoa: Array<Array<string | number>> = [pad([]), pad(['', 'From Date', bansiDmy(sheet.from), 'To Date', bansiDmy(sheet.to)]), BANSI_HEAD];
  const kinds: Array<BansiLine['kind'] | 'head' | 'date' | 'gap'> = ['gap', 'date', 'head'];
  for (const l of sheet.lines) {
    if (l.kind === 'vsp') aoa.push(pad(['VSP Name']));
    else if (l.kind === 'farmer') aoa.push([l.sr, l.name, ...l.v]);
    else if (l.kind === 'centre') aoa.push(['', l.text, ...l.v]);
    else {
      aoa.push(pad([]));
      kinds.push('gap');
      aoa.push(['', l.text, ...l.v]);
    }
    kinds.push(l.kind);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = COL_WIDTHS.map((wch) => ({ wch }));

  const edge = { style: 'thin', color: { rgb: '000000' } };
  const border = { top: edge, bottom: edge, left: edge, right: edge };
  aoa.forEach((row, r) => {
    const kind = kinds[r];
    if (kind === 'gap') return; // the empty first row and the empty row above "Total :" have no lines
    row.forEach((v, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] ?? (ws[addr] = { t: 's', v: '' });
      if (typeof v === 'number' && c >= 2) cell.z = BANSI_DECIMALS[c - 2] === 1 ? '0.0' : '#,##0.00';
      if (typeof v === 'number' && c === 0) cell.z = '0';
      // bold: heading, "VSP Name" rows, every centre's total row, the grand "Total :" row and the From / To Date labels
      const bold = kind === 'head' || kind === 'vsp' || kind === 'centre' || kind === 'total' || (kind === 'date' && c % 2 === 1);
      (cell as unknown as { s?: unknown }).s = {
        font: { bold },
        border,
        alignment: { horizontal: typeof v === 'number' ? 'right' : 'left', vertical: 'center' },
      };
    });
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, excelFileName(bansiFileName(fileScope, sheet.from, sheet.to)), { compression: true });
}

/** kept for older callers */
export async function exportBansiAllExcel(rows: CollectionEntry[], from: string, to: string, nameOf: (id: string) => string): Promise<void> {
  await exportBansiSheet(buildBansiSheet(rows, from, to, nameOf), 'All');
}

