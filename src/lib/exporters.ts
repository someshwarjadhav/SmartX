import { toSylk } from './sylk';

export type ColType = 'text' | 'int' | 'dec1' | 'dec2' | 'money' | 'num2' | 'general';

/**
 * How the Total row is calculated for a column (Excel gets a real formula, PDF / CSV / print get the same value):
 *  'sum'                 =SUM(column)
 *  { wavg: col }         weighted average, weighted by column `col` (fat / snf by litres)
 *  { ratio: [n, d] }     SUM(col n) / SUM(col d)   (average rate = amount / litres)
 *  { diff: [a, b] }      total of column a minus total of column b
 */
export type TotalKind = 'sum' | { wavg: number } | { ratio: [number, number] } | { diff: [number, number] };

export interface ExportColumn {
  header: string;
  type?: ColType;
  total?: TotalKind;
}

/** Cells of column `col` are merged downwards while the columns listed in `by` keep the same value (grouped reports). */
export interface MergeSpec {
  col: number;
  by: number[];
}

export interface ExportTable {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Array<Array<string | number>>;
  totals?: Array<string | number>;
  /** extra header row above the column names, e.g. DOC Collection / VLC Collection / Difference */
  headerGroups?: Array<{ label: string; span: number }>;
  /** vertical merges (Excel + PDF) for grouped reports */
  merge?: MergeSpec[];
}

/** For rows in order: span of each run of equal keys (first row of a run = run length, the others = 0). */
export function runSpans(keys: string[]): number[] {
  const out: number[] = new Array(keys.length).fill(0);
  let start = 0;
  for (let i = 1; i <= keys.length; i++) {
    if (i === keys.length || keys[i] !== keys[start]) {
      out[start] = i - start;
      start = i;
    }
  }
  return out;
}

const spansFor = (rows: Array<Array<string | number>>, m: MergeSpec): number[] => runSpans(rows.map((r) => m.by.map((c) => String(r[c] ?? '')).join('\u0001')));

const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Gives the Total row of a finished table real formulas, looking at the column names:
 * Liter / Qty / Kg / Amount = SUM, Fat / Snf / Clr / Water = average weighted by Liter, Rate = Amount / Liter.
 * Columns it does not know keep their fixed `totals` text.
 */
export function withFormulaTotals(t: ExportTable): ExportTable {
  const find = (names: string[]): number => t.columns.findIndex((c) => names.includes(c.header.trim().toLowerCase()));
  const qty = find(['liter', 'qty', 'total liter']);
  const amount = find(['amount', 'total amount']);
  const SUM = ['liter', 'qty', 'total liter', 'kg', 'amount', 'total amount', 'kg fat', 'kg snf', 'farmer'];
  const AVG = ['fat', 'snf', 'clr', 'water', 'avg fat', 'avg. fat', 'avg snf', 'avg. snf'];
  const RATE = ['rate', 'avg rate', 'avg. rate'];
  return {
    ...t,
    columns: t.columns.map((c) => {
      const h = c.header.trim().toLowerCase();
      if (c.total) return c;
      if (SUM.includes(h) && c.type && c.type !== 'text') return { ...c, total: 'sum' as const };
      if (AVG.includes(h) && qty >= 0) return { ...c, total: { wavg: qty } };
      if (RATE.includes(h) && qty >= 0 && amount >= 0) return { ...c, total: { ratio: [amount, qty] as [number, number] } };
      return c;
    }),
  };
}

/** Total row values of a table (computed from the `total` kinds of its columns, else the fixed `totals`). */
export function totalsOf(t: ExportTable): Array<string | number> | undefined {
  if (!t.columns.some((c) => c.total)) return t.totals;
  const col = (i: number): number[] => t.rows.map((r) => Number(r[i]) || 0);
  const sum = (i: number): number => col(i).reduce((a, b) => a + b, 0);
  const out: Array<string | number> = t.columns.map((c, i) => {
    const k = c.total;
    if (!k || (typeof k === 'object' && 'diff' in k)) return typeof t.totals?.[i] === 'string' ? (t.totals[i] as string) : '';
    if (k === 'sum') return r2(sum(i));
    if ('wavg' in k) {
      const w = sum(k.wavg);
      const v = col(i);
      const wt = col(k.wavg);
      return w ? r2(v.reduce((a, x, j) => a + x * (wt[j] ?? 0), 0) / w) : 0;
    }
    const d = sum(k.ratio[1]);
    return d ? r2(sum(k.ratio[0]) / d) : 0;
  });
  t.columns.forEach((c, i) => {
    const k = c.total;
    if (k && typeof k === 'object' && 'diff' in k) out[i] = r2(Number(out[k.diff[0]]) - Number(out[k.diff[1]]));
  });
  if (out[0] === '') out[0] = 'Total';
  return out;
}

const IN = 'en-IN';
const num = (v: number, d: number): string => new Intl.NumberFormat(IN, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

const DECIMALS: Record<ColType, number | undefined> = { text: undefined, int: 0, dec1: 1, dec2: 2, money: 2, num2: 2, general: undefined };

function show(v: string | number, type: ColType | undefined, rupee: string): string {
  if (typeof v !== 'number') return String(v ?? '');
  switch (type) {
    case 'int': return num(v, 0);
    case 'dec1': return num(v, 1);
    case 'dec2':
    case 'num2': return num(v, 2);
    case 'money': return `${rupee}${num(v, 2)}`;
    default: return String(v);
  }
}

const isNumeric = (t?: ColType): boolean => t !== undefined && t !== 'text';
const stamp = (): string => new Date().toLocaleString(IN, { dateStyle: 'medium', timeStyle: 'short' });

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ------------------------------------------------------------------ */
/*  Theme palette (paper-safe version of the active SmartX theme)      */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

const WHITE: RGB = [255, 255, 255];
const FALLBACK: Record<string, RGB> = { brand: [36, 99, 235], ink: [11, 26, 61], mute: [91, 107, 143], deep: [27, 55, 113] };

function cssVar(name: string): RGB {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
    const p = raw.split(/[\s,/]+/).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every((n) => Number.isFinite(n))) return [p[0]!, p[1]!, p[2]!];
  } catch {
    /* no document (tests / SSR) -> fallback colour */
  }
  return FALLBACK[name] ?? FALLBACK.brand!;
}

const luma = ([r, g, b]: RGB): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as RGB;
const hex = ([r, g, b]: RGB): string => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;

export interface Palette {
  brand: RGB;
  /** text colour that is readable on `brand` */
  onBrand: RGB;
  text: RGB;
  mute: RGB;
  line: RGB;
  stripe: RGB;
  totalBg: RGB;
}

export function reportPalette(): Palette {
  const brandRaw = cssVar('brand');
  // a very light brand (dark themes) is darkened a little so white paper keeps a clear header band
  const brand = luma(brandRaw) > 0.62 ? mix(brandRaw, [0, 0, 0], 0.35) : brandRaw;
  const inkRaw = cssVar('ink');
  const text = luma(inkRaw) < 0.4 ? inkRaw : cssVar('deep'); // dark themes have a light `ink`
  return {
    brand,
    onBrand: luma(brand) > 0.6 ? [11, 18, 36] : WHITE,
    text: luma(text) < 0.4 ? text : [11, 26, 61],
    mute: mix(text, WHITE, 0.4),
    line: mix(WHITE, brand, 0.28),
    stripe: mix(WHITE, brand, 0.06),
    totalBg: mix(WHITE, brand, 0.14),
  };
}

/* ------------------------------------------------------------------ */
/*  CSV                                                                */
/* ------------------------------------------------------------------ */

/**
 * Dates in a CSV are turned into "04-Nov-26": Excel reads that as a real date and shows it in a narrow column.
 * "04 Nov 2026" / "04-11-2026" were read as dates too but shown in a long format, so the column showed ######### .
 */
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function csvDate(v: string): string | null {
  const t = v.trim();
  let d: string | undefined;
  let m: number | undefined;
  let y: string | undefined;
  let hit = /^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{4})$/.exec(t); // 04 Nov 2026 / 04-Nov-2026
  if (hit) {
    d = hit[1];
    m = MON_SHORT.findIndex((x) => x.toLowerCase() === hit![2]!.toLowerCase()) + 1;
    y = hit[3];
  } else if ((hit = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/.exec(t))) { // 04-11-2026 / 04.11.2026 / 04/11/2026
    d = hit[1];
    m = Number(hit[2]);
    y = hit[3];
  } else if ((hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) { // 2026-11-04
    y = hit[1];
    m = Number(hit[2]);
    d = hit[3];
  }
  if (!d || !y || !m || m < 1 || m > 12) return null;
  return `${d.padStart(2, '0')}-${MON_SHORT[m - 1]}-${y.slice(2)}`;
}

export function exportCSV(t: ExportTable): void {
  // .csv file name, but written so Excel opens it with every column as wide as its longest value (see lib/sylk.ts)
  const tot = totalsOf(t);
  const plain = (r: Array<string | number>) => r.map((v) => (typeof v === 'number' ? v : csvDate(v) ?? v));
  const rows = [...t.rows, ...(tot && t.rows.length > 0 ? [tot] : [])].map(plain);
  save(new Blob([toSylk(t.columns.map((c) => c.header), rows)], { type: 'text/csv;charset=utf-8' }), `${t.filename}.csv`);
}

/* ------------------------------------------------------------------ */
/*  Excel                                                              */
/* ------------------------------------------------------------------ */

const XLSX_FORMAT: Record<ColType, string | undefined> = { text: undefined, int: '#,##0', dec1: '#,##0.0', dec2: '#,##0.00', money: '"₹"#,##0.00', num2: '0.00', general: undefined };

/**
 * One worksheet for every Excel export.
 *  titleBlock: title / filter / generated lines on top (New style report); false = plain header on row 1 (STIPL old / new Excel)
 *  Total row = real Excel formulas (=SUM, weighted average ...) so the sheet keeps working when someone edits a value.
 */
function buildSheet(XLSX: typeof import('xlsx'), t: ExportTable, titleBlock: boolean) {
  const ncol = t.columns.length;
  const top: Array<Array<string | number>> = [];
  if (titleBlock) top.push([t.title], [t.subtitle ?? ''], [`Generated ${stamp()}`], []);
  const groupRow = t.headerGroups ? top.length : -1;
  if (t.headerGroups) {
    const row: string[] = [];
    for (const g of t.headerGroups) {
      row.push(g.label);
      for (let i = 1; i < g.span; i++) row.push('');
    }
    while (row.length < ncol) row.push('');
    top.push(row);
  }
  const headerRow = top.length;
  top.push(t.columns.map((c) => c.header));
  const first = top.length; // 0-based index of the first data row
  const n = t.rows.length;
  const aoa: Array<Array<string | number>> = [...top, ...t.rows];
  const totals = n > 0 ? totalsOf(t) : undefined;
  const totalRow = first + n; // 0-based
  if (totals) aoa.push(totals);
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // widths: every column is as wide as its longest value (names, dates, amounts as they will be shown) or its heading,
  // so nothing is cut off or shown as ####. Headings get a little extra room for the filter arrow.
  const widthOf = (v: string | number | undefined, type: ColType | undefined): number => {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') {
      const d = DECIMALS[type ?? 'text'];
      const txt = d === undefined ? String(v) : num(v, d);
      return type === 'money' ? txt.length + 1 : txt.length;
    }
    return String(v).length;
  };
  ws['!cols'] = t.columns.map((c, i) => {
    let longest = c.header.length + 3;
    for (const r of t.rows) longest = Math.max(longest, widthOf(r[i], c.type));
    if (totals) longest = Math.max(longest, widthOf(totals[i], c.type));
    return { wch: Math.min(70, Math.max(9, longest + 2)) };
  });

  // merges: title lines, header groups, grouped (vertical) cells
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
  if (titleBlock) for (const r of [0, 1, 2]) merges.push({ s: { r, c: 0 }, e: { r, c: Math.max(0, ncol - 1) } });
  if (t.headerGroups && groupRow >= 0) {
    let c = 0;
    for (const g of t.headerGroups) {
      if (g.span > 1) merges.push({ s: { r: groupRow, c }, e: { r: groupRow, c: c + g.span - 1 } });
      c += g.span;
    }
  }
  for (const m of t.merge ?? []) {
    spansFor(t.rows, m).forEach((span, i) => {
      if (span > 1) merges.push({ s: { r: first + i, c: m.col }, e: { r: first + i + span - 1, c: m.col } });
    });
  }
  if (merges.length) ws['!merges'] = merges;
  if (titleBlock && !t.merge?.length) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + n, c: Math.max(0, ncol - 1) } }) };
  }
  if (!titleBlock && !t.merge?.length && n > 0) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + n, c: Math.max(0, ncol - 1) } }) };
  }

  // number formats for the data rows and the total row
  const last = first + n + (totals ? 1 : 0);
  for (let r = first; r < last; r++) {
    t.columns.forEach((c, ci) => {
      const f = XLSX_FORMAT[c.type ?? 'text'];
      const cell = ws[XLSX.utils.encode_cell({ r, c: ci })];
      if (f && cell && cell.t === 'n') cell.z = f;
    });
  }

  // total row: formulas (cached values are kept so viewers that do not recalculate still show the numbers)
  if (totals) {
    const L = (i: number): string => XLSX.utils.encode_col(i);
    const rng = (i: number): string => `${L(i)}${first + 1}:${L(i)}${first + n}`;
    const tr = totalRow + 1; // 1-based
    t.columns.forEach((c, ci) => {
      const k = c.total;
      if (!k) return;
      let f: string;
      if (k === 'sum') f = `SUM(${rng(ci)})`;
      else if ('wavg' in k) f = `IFERROR(SUMPRODUCT(${rng(k.wavg)},${rng(ci)})/SUM(${rng(k.wavg)}),0)`;
      else if ('ratio' in k) f = `IFERROR(SUM(${rng(k.ratio[0])})/SUM(${rng(k.ratio[1])}),0)`;
      else f = `${L(k.diff[0])}${tr}-${L(k.diff[1])}${tr}`;
      const addr = XLSX.utils.encode_cell({ r: totalRow, c: ci });
      const z = XLSX_FORMAT[c.type ?? 'text'] ?? '0.00';
      ws[addr] = { t: 'n', v: Number(totals[ci]) || 0, f, z };
    });
  }
  return ws;
}

/** New style Excel: title block, filters line, header, data, total row with formulas. */
export async function exportExcel(t: ExportTable): Promise<void> {
  const XLSX = await import('xlsx');
  // only header row + data + total row (no title / filter / generated lines)
  const ws = buildSheet(XLSX, t, false);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  XLSX.writeFile(wb, `${t.filename}.xlsx`);
}

/** STIPL style Excel (old / new export): header on row 1, data below, total row with formulas, sheet "Sheet1". */
export async function exportPlainExcel(t: ExportTable): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = buildSheet(XLSX, t, false);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${t.filename}.xlsx`);
}

/** kept for older pages: same as the plain STIPL sheet */
export const exportLegacyExcel = exportPlainExcel;

/* ------------------------------------------------------------------ */
/*  PDF                                                                */
/* ------------------------------------------------------------------ */

export async function exportPDF(t: ExportTable): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  // works for both the browser (ES module) and CommonJS interop shapes of jspdf-autotable
  const mod = autoTableMod as unknown as { default: unknown; autoTable?: unknown };
  const autoTable = (typeof mod.default === 'function' ? mod.default : (mod.default as { default?: unknown } | undefined)?.default ?? mod.autoTable) as typeof autoTableMod.default;
  const p = reportPalette();
  const cols = t.columns.length;
  // wide reports (e.g. Variance, 19 columns) get a bigger sheet so the text stays readable
  const doc = new jsPDF({ orientation: cols > 6 ? 'landscape' : 'portrait', unit: 'pt', format: cols > 14 ? 'a3' : 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const M = 36;

  const head = (): void => {
    doc.setFillColor(...p.brand);
    doc.rect(0, 0, w, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...p.text);
    doc.text(t.title, M, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...p.mute);
    if (t.subtitle) doc.text(t.subtitle, M, 56);
    doc.text(`SmartX  |  Generated ${stamp()}`, M, t.subtitle ? 70 : 56);
    doc.setDrawColor(...p.brand);
    doc.setLineWidth(1.2);
    doc.line(M, t.subtitle ? 78 : 64, w - M, t.subtitle ? 78 : 64);
  };
  head();

  const spanOf = (t.merge ?? []).map((m) => ({ col: m.col, spans: spansFor(t.rows, m) }));
  const body = t.rows.map((r, ri) => {
    const cells: Array<string | { content: string; rowSpan: number; styles: { valign: 'middle' } }> = [];
    r.forEach((v, i) => {
      const m = spanOf.find((x) => x.col === i);
      const text = show(v, t.columns[i]?.type, 'Rs ');
      if (!m) return void cells.push(text);
      const span = m.spans[ri] ?? 0;
      if (span === 0) return; // covered by the merged cell above
      cells.push(span > 1 ? { content: text, rowSpan: span, styles: { valign: 'middle' } } : text);
    });
    return cells;
  });
  const totals = totalsOf(t);
  const foot = totals ? [totals.map((v, i) => show(v, t.columns[i]?.type, 'Rs '))] : undefined;
  const headRows = [
    ...(t.headerGroups ? [t.headerGroups.map((g) => ({ content: g.label, colSpan: g.span, styles: { halign: 'center' as const } }))] : []),
    t.columns.map((c) => c.header),
  ];
  const align: Record<number, { halign: 'right' | 'left' }> = {};
  t.columns.forEach((c, i) => {
    align[i] = { halign: isNumeric(c.type) ? 'right' : 'left' };
  });
  const fontSize = cols > 14 ? 7.5 : cols > 10 ? 8 : 9;
  const pad = cols > 14 ? 3.5 : 5;

  autoTable(doc, {
    startY: t.subtitle ? 90 : 76,
    head: headRows,
    body,
    foot,
    showFoot: 'lastPage',
    showHead: 'everyPage',
    columnStyles: align,
    styles: { fontSize, cellPadding: pad, textColor: p.text, lineColor: p.line, lineWidth: 0.4, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: p.brand, textColor: p.onBrand, fontStyle: 'bold', lineColor: p.brand },
    footStyles: { fillColor: p.totalBg, textColor: p.text, fontStyle: 'bold', lineColor: p.brand, lineWidth: 0.6 },
    alternateRowStyles: { fillColor: p.stripe },
    margin: { left: M, right: M, top: 40, bottom: 36 },
    didParseCell: (d) => {
      // header cells follow the numeric alignment of their column
      if (d.section === 'head' && t.headerGroups && d.row.index === 0) d.cell.styles.halign = 'center';
      else if (d.section === 'head' || d.section === 'foot') d.cell.styles.halign = isNumeric(t.columns[d.column.index]?.type) ? 'right' : 'left';
    },
    didDrawPage: (d) => {
      if (d.pageNumber > 1) {
        doc.setFillColor(...p.brand);
        doc.rect(0, 0, w, 6, 'F');
      }
    },
  });

  // page numbers (need the final page count, so they are drawn after the table)
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...p.mute);
    doc.setDrawColor(...p.line);
    doc.setLineWidth(0.5);
    doc.line(M, h - 28, w - M, h - 28);
    doc.text('SmartX', M, h - 15);
    doc.text(`Page ${i} of ${pages}`, w - M, h - 15, { align: 'right' });
  }

  doc.save(`${t.filename}.pdf`);
}

/* ------------------------------------------------------------------ */
/*  Print                                                              */
/* ------------------------------------------------------------------ */

const esc = (s: string | number): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

function printCss(p: Palette, landscape: boolean, dense: boolean): string {
  const fs = dense ? 9 : 10.5;
  return `
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font: ${fs}px/1.4 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: ${hex(p.text)}; }
  .bar { height: 6px; background: ${hex(p.brand)}; border-radius: 3px; margin: 0 0 10px; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 2px solid ${hex(p.brand)}; padding-bottom: 8px; margin-bottom: 10px; }
  h1 { font-size: 19px; margin: 0 0 3px; color: ${hex(p.text)}; }
  .meta { margin: 0; color: ${hex(p.mute)}; font-size: ${fs}px; }
  .brand { font-weight: 700; font-size: 13px; color: ${hex(p.brand)}; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; border: 1px solid ${hex(p.brand)}; }
  th, td { padding: ${dense ? '4px 5px' : '5px 7px'}; border: 1px solid ${hex(p.line)}; vertical-align: middle; }
  th { background: ${hex(p.brand)}; color: ${hex(p.onBrand)}; text-align: left; font-weight: 700; font-size: ${fs}px; border-color: ${hex(p.brand)}; border-bottom: 2px solid ${hex(p.text)}; }
  td { font-size: ${fs}px; }
  tbody tr:nth-child(even) td { background: ${hex(p.stripe)}; }
  .r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot td { background: ${hex(p.totalBg)}; font-weight: 800; border-top: 2px solid ${hex(p.text)}; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .foot { margin-top: 10px; display: flex; justify-content: space-between; color: ${hex(p.mute)}; font-size: 9px; border-top: 1px solid ${hex(p.line)}; padding-top: 5px; }
`;
}

export function printHTML(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1500);
  };
  if (doc.readyState === 'complete') setTimeout(run, 150);
  else frame.onload = () => setTimeout(run, 150);
}

export function printTable(t: ExportTable): void {
  const p = reportPalette();
  const cell = (v: string | number, i: number, tag: 'td' | 'th' = 'td') =>
    `<${tag} class="${isNumeric(t.columns[i]?.type) ? 'r' : ''}">${esc(show(v, t.columns[i]?.type, '₹'))}</${tag}>`;
  const head = t.columns.map((c) => `<th class="${isNumeric(c.type) ? 'r' : ''}">${esc(c.header)}</th>`).join('');
  const body = t.rows.map((r) => `<tr>${r.map((v, i) => cell(v, i)).join('')}</tr>`).join('');
  const totals = totalsOf(t);
  const foot = totals ? `<tfoot><tr>${totals.map((v, i) => cell(v, i)).join('')}</tr></tfoot>` : '';
  const landscape = t.columns.length > 6;
  printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.title)}</title><style>${printCss(p, landscape, t.columns.length > 10)}</style></head><body>
    <div class="bar"></div>
    <div class="top"><div><h1>${esc(t.title)}</h1><p class="meta">${t.subtitle ? `${esc(t.subtitle)}` : ''}</p></div><div style="text-align:right"><div class="brand">SmartX</div><p class="meta">Generated ${esc(stamp())}</p></div></div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>
    <div class="foot"><span>SmartX</span><span>${t.rows.length} rows</span></div></body></html>`);
}

export { esc as escapeHtml };
