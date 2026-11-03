
export type ColType = 'text' | 'int' | 'dec1' | 'dec2' | 'money';

export interface ExportColumn {
  header: string;
  type?: ColType;
}

export interface ExportTable {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Array<Array<string | number>>;
  totals?: Array<string | number>;
}

const IN = 'en-IN';
const num = (v: number, d: number): string => new Intl.NumberFormat(IN, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

const DECIMALS: Record<ColType, number | undefined> = { text: undefined, int: 0, dec1: 1, dec2: 2, money: 2 };

function show(v: string | number, type: ColType | undefined, rupee: string): string {
  if (typeof v !== 'number') return String(v ?? '');
  switch (type) {
    case 'int': return num(v, 0);
    case 'dec1': return num(v, 1);
    case 'dec2': return num(v, 2);
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

const csvCell = (v: string | number): string => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Plain numbers (no thousands separator / currency symbol) so Excel and other tools read them as numbers. */
function csvValue(v: string | number, type: ColType | undefined): string | number {
  const d = DECIMALS[type ?? 'text'];
  return typeof v === 'number' && d !== undefined ? v.toFixed(d) : v;
}

export function exportCSV(t: ExportTable): void {
  const line = (r: Array<string | number>) => r.map((v, i) => csvCell(csvValue(v, t.columns[i]?.type))).join(',');
  const lines = [t.columns.map((c) => csvCell(c.header)).join(','), ...t.rows.map(line)];
  if (t.totals) lines.push(line(t.totals));
  save(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${t.filename}.csv`);
}

/* ------------------------------------------------------------------ */
/*  Excel                                                              */
/* ------------------------------------------------------------------ */

export async function exportExcel(t: ExportTable): Promise<void> {
  const XLSX = await import('xlsx');
  const aoa: Array<Array<string | number>> = [[t.title], [t.subtitle ?? ''], [`Generated ${stamp()}`], [], t.columns.map((c) => c.header), ...t.rows];
  if (t.totals) aoa.push(t.totals);
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = t.columns.map((c, i) => {
    const longest = Math.max(c.header.length, ...t.rows.slice(0, 200).map((r) => String(r[i] ?? '').length));
    return { wch: Math.min(34, Math.max(9, longest + 2)) };
  });
  ws['!merges'] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: Math.max(0, t.columns.length - 1) } }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 4, c: 0 }, e: { r: 4 + t.rows.length, c: Math.max(0, t.columns.length - 1) } }) };

  const fmt: Record<ColType, string | undefined> = { text: undefined, int: '#,##0', dec1: '#,##0.0', dec2: '#,##0.00', money: '"₹"#,##0.00' };
  const first = 5;
  const last = first + t.rows.length + (t.totals ? 1 : 0);
  for (let r = first; r < last; r++) {
    t.columns.forEach((c, ci) => {
      const f = fmt[c.type ?? 'text'];
      const cell = ws[XLSX.utils.encode_cell({ r, c: ci })];
      if (f && cell && cell.t === 'n') cell.z = f;
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  XLSX.writeFile(wb, `${t.filename}.xlsx`);
}

export async function exportLegacyExcel(t: ExportTable): Promise<void> {
  const XLSX = await import('xlsx');
  const aoa: Array<Array<string | number>> = [t.columns.map((c) => c.header), ...t.rows];
  if (t.totals) aoa.push(t.totals);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${t.filename}.xls`, { bookType: 'xls' });
}

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

  const body = t.rows.map((r) => r.map((v, i) => show(v, t.columns[i]?.type, 'Rs ')));
  const foot = t.totals ? [t.totals.map((v, i) => show(v, t.columns[i]?.type, 'Rs '))] : undefined;
  const align: Record<number, { halign: 'right' | 'left' }> = {};
  t.columns.forEach((c, i) => {
    align[i] = { halign: isNumeric(c.type) ? 'right' : 'left' };
  });
  const fontSize = cols > 14 ? 7.5 : cols > 10 ? 8 : 9;
  const pad = cols > 14 ? 3.5 : 5;

  autoTable(doc, {
    startY: t.subtitle ? 90 : 76,
    head: [t.columns.map((c) => c.header)],
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
      if (d.section === 'head' || d.section === 'foot') d.cell.styles.halign = isNumeric(t.columns[d.column.index]?.type) ? 'right' : 'left';
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
  const foot = t.totals ? `<tfoot><tr>${t.totals.map((v, i) => cell(v, i)).join('')}</tr></tfoot>` : '';
  const landscape = t.columns.length > 6;
  printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.title)}</title><style>${printCss(p, landscape, t.columns.length > 10)}</style></head><body>
    <div class="bar"></div>
    <div class="top"><div><h1>${esc(t.title)}</h1><p class="meta">${t.subtitle ? `${esc(t.subtitle)}` : ''}</p></div><div style="text-align:right"><div class="brand">SmartX</div><p class="meta">Generated ${esc(stamp())}</p></div></div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>
    <div class="foot"><span>SmartX</span><span>${t.rows.length} rows</span></div></body></html>`);
}

export { esc as escapeHtml };
