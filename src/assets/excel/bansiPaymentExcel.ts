import { excelFileName } from './fileName';
import { isBansiUser as isBansiLogin } from './bansiExcel';

/**
 * Bansi's Payment Summary Excel: same sheet layout as the Bansi "All" collection Excel
 * (From/To Date row, header row, "VSP Name" row per centre, farmers, the centre's own total row and a
 * grand "Total :" row at the end). Only the Bansi Dairy Nagpur login (user id 307) gets this sheet from the
 * Excel export of Bank / Cash Payment Summary; every other login keeps the normal export.
 */
export const isBansiUser = (): boolean => isBansiLogin();

/** how a numeric column is rolled up into the centre / grand total rows */
export type PayAgg = 'sum' | 'wavg';

export interface BansiPayCol<T> {
  header: string;
  agg: PayAgg;
  /** decimals shown (1 for Fat / Snf, 2 for the rest) */
  dec: 1 | 2;
  value: (r: T) => number;
}

export interface BansiPayText<T> {
  header: string;
  value: (r: T) => string;
}

export interface BansiPayInput<T> {
  rows: T[];
  from: string;
  to: string;
  fileLabel: string;
  centreOf: (r: T) => string;
  idOf: (r: T) => string;
  nameOf: (r: T) => string;
  /** centre label as "Name | Code" (or just a code) */
  centreLabel: (centreId: string) => string;
  /** text columns that sit right after Farmer Name (Bank Name, Account No, IFSC ...) */
  texts?: Array<BansiPayText<T>>;
  cols: Array<BansiPayCol<T>>;
  /** the numeric column the averages are weighted by (index in cols) */
  weightIndex: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const r1 = (n: number): number => Math.round(n * 10) / 10;
const dmy = (iso: string): string => {
  const [y = '', m = '', d = ''] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
};
const idNum = (id: string): number => (/^\d+$/.test(id) ? Number(id) : Number.MAX_SAFE_INTEGER);

const centreText = (label: string, id: string): string => {
  const parts = label.split(' | ');
  if (parts.length >= 2) {
    const code = parts[parts.length - 1].trim();
    const name = parts.slice(0, -1).join(' | ').trim();
    return name && name !== code ? `${code} - ${name}` : code;
  }
  return label || id;
};

export async function exportBansiPaymentExcel<T>(input: BansiPayInput<T>): Promise<void> {
  const XLSX = await import('xlsx');
  const { rows, cols, texts = [], weightIndex } = input;
  const tn = texts.length;
  const w = Math.max(0, Math.min(weightIndex, cols.length - 1));

  const figures = (list: T[]): number[] => {
    const weight = list.reduce((a, r) => a + cols[w].value(r), 0);
    return cols.map((c) => {
      const out = c.agg === 'sum'
        ? list.reduce((a, r) => a + c.value(r), 0)
        : weight
          ? list.reduce((a, r) => a + c.value(r) * cols[w].value(r), 0) / weight
          : 0;
      return c.dec === 1 ? r1(out) : r2(out);
    });
  };

  const byCentre = new Map<string, T[]>();
  for (const r of rows) {
    const k = input.centreOf(r);
    const list = byCentre.get(k);
    if (list) list.push(r); else byCentre.set(k, [r]);
  }

  const blanks = Array.from({ length: tn }, () => '');
  const aoa: Array<Array<string | number>> = [
    [],
    ['', 'From Date', dmy(input.from), 'To Date', dmy(input.to)],
    ['Sr No', 'Farmer Name', ...texts.map((t) => t.header), ...cols.map((c) => c.header)],
  ];
  const decs: number[] = [];

  [...byCentre.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach((centre, i) => {
    aoa.push(['VSP Name']);
    const list = [...byCentre.get(centre)!].sort((a, b) => idNum(input.idOf(a)) - idNum(input.idOf(b)) || input.idOf(a).localeCompare(input.idOf(b)));
    list.forEach((r, n) => aoa.push([n + 1, input.nameOf(r), ...texts.map((t) => t.value(r)), ...figures([r])]));
    aoa.push(['', `${i + 1}. ${centreText(input.centreLabel(centre), centre)}`, ...blanks, ...figures(list)]);
  });
  aoa.push([]);
  aoa.push(['', 'Total :', ...blanks, ...figures(rows)]);
  cols.forEach((c) => decs.push(c.dec));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 7 }, { wch: 40 }, ...texts.map(() => ({ wch: 22 })), ...cols.map(() => ({ wch: 14 }))];
  aoa.forEach((row, r) => row.forEach((v, c) => {
    if (typeof v === 'number' && c >= 2 + tn) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = decs[c - 2 - tn] === 1 ? '0.0' : '#,##0.00';
    }
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const file = (d: string): string => dmy(d).replace(/\//g, '-');
  XLSX.writeFile(wb, excelFileName(`${input.fileLabel} ${file(input.from)}_${file(input.to)}`), { compression: true });
}
