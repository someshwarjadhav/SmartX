
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

function show(v: string | number, type: ColType | undefined, rupee: string): string {
  if (typeof v !== 'number') return String(v);
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

const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCSV(t: ExportTable): void {
  const lines = [t.columns.map((c) => csvCell(c.header)).join(',')];
  for (const r of t.rows) lines.push(r.map(csvCell).join(','));
  if (t.totals) lines.push(t.totals.map(csvCell).join(','));
  save(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${t.filename}.csv`);
}

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

export async function exportPDF(t: ExportTable): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ orientation: t.columns.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setFillColor(36, 99, 235);
  doc.rect(0, 0, w, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(11, 26, 61);
  doc.text(t.title, 40, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(91, 107, 143);
  if (t.subtitle) doc.text(t.subtitle, 40, 58);
  doc.text(`SmartX  |  Generated ${stamp()}`, 40, t.subtitle ? 72 : 58);

  const body = t.rows.map((r) => r.map((v, i) => show(v, t.columns[i]?.type, 'Rs ')));
  const foot = t.totals ? [t.totals.map((v, i) => show(v, t.columns[i]?.type, 'Rs '))] : undefined;
  const align: Record<number, { halign: 'right' | 'left' }> = {};
  t.columns.forEach((c, i) => {
    align[i] = { halign: isNumeric(c.type) ? 'right' : 'left' };
  });

  autoTable(doc, {
    startY: t.subtitle ? 86 : 72,
    head: [t.columns.map((c) => c.header)],
    body,
    foot,
    columnStyles: align,
    styles: { fontSize: 8.5, cellPadding: 5, textColor: [11, 26, 61], lineColor: [221, 229, 244], lineWidth: 0.4 },
    headStyles: { fillColor: [36, 99, 235], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [232, 240, 255], textColor: [11, 26, 61], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 250, 255] },
    margin: { left: 40, right: 40, bottom: 40 },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8.5);
      doc.setTextColor(120, 132, 160);
      doc.text(`Page ${page}`, w - 40, h - 20, { align: 'right' });
      doc.text('SmartX', 40, h - 20);
    },
  });

  doc.save(`${t.filename}.pdf`);
}

const esc = (s: string | number): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0b1a3d; }
  .bar { height: 5px; background: #2463eb; margin-bottom: 14px; border-radius: 3px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #5b6b8f; margin: 0 0 14px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #2463eb; color: #fff; text-align: left; padding: 7px 8px; font-size: 11px; }
  td { padding: 6px 8px; border-bottom: 1px solid #dde5f4; font-size: 11px; }
  tbody tr:nth-child(even) td { background: #f7faff; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { background: #e8f0ff; font-weight: 700; border-top: 2px solid #2463eb; }
  thead { display: table-header-group; } tfoot { display: table-row-group; }
  tr { break-inside: avoid; }
  .foot { margin-top: 12px; color: #78849f; font-size: 10px; }
`;

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
  const head = t.columns.map((c) => `<th class="${isNumeric(c.type) ? 'r' : ''}">${esc(c.header)}</th>`).join('');
  const body = t.rows
    .map((r) => `<tr>${r.map((v, i) => `<td class="${isNumeric(t.columns[i]?.type) ? 'r' : ''}">${esc(show(v, t.columns[i]?.type, '₹'))}</td>`).join('')}</tr>`)
    .join('');
  const foot = t.totals
    ? `<tfoot><tr>${t.totals.map((v, i) => `<td class="${isNumeric(t.columns[i]?.type) ? 'r' : ''}">${esc(show(v, t.columns[i]?.type, '₹'))}</td>`).join('')}</tr></tfoot>`
    : '';
  printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.title)}</title><style>${PRINT_CSS}</style></head><body>
    <div class="bar"></div><h1>${esc(t.title)}</h1>
    <p class="meta">${t.subtitle ? `${esc(t.subtitle)} &nbsp;|&nbsp; ` : ''}Generated ${esc(stamp())}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>
    <p class="foot">SmartX · ${t.rows.length} rows</p></body></html>`);
}

export { esc as escapeHtml };
