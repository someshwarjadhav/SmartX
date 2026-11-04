import { toSylk } from '../sylk';

export interface ExportCol<T = unknown> {
  header: string;
  value: (row: T) => string | number;
}

const htmlEsc = (value: string | number) => String(value).replace(/[&<>"']/g, (char) => {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return entities[char] ?? char;
});

function download(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportCSV<T>(name: string, cols: ExportCol<T>[], rows: T[]) {
  // .csv file name, but written so Excel opens it with every column as wide as its longest value (see lib/sylk.ts)
  download(`${name}.csv`, 'text/csv;charset=utf-8', toSylk(cols.map((c) => c.header), rows.map((r) => cols.map((c) => cellValue(c.value(r))))));
}

const cellValue = (v: string | number): string | number => {
  if (typeof v === 'number') return v;
  const t = v.trim();
  if (/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(t)) return Number(t);
  return v;
};


export async function exportExcel<T>(name: string, cols: ExportCol<T>[], rows: T[]) {
  const XLSX = await import('xlsx');
  const head = cols.map((c) => c.header);
  const body = rows.map((r) => cols.map((c) => cellValue(c.value(r))));
  // only the column headings and the data rows - no title / generated / footer lines
  const aoa: Array<Array<string | number>> = [head, ...body];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // every column as wide as its longest value / heading, so names and amounts are never cut off
  const textOf = (v: string | number | undefined): string => (typeof v === 'number' ? v.toLocaleString('en-IN', { maximumFractionDigits: 4 }) : String(v ?? ''));
  ws['!cols'] = head.map((h, i) => {
    let longest = String(h).length + 3;
    for (const r of body) longest = Math.max(longest, textOf(r[i]).length);
    return { wch: Math.min(70, Math.max(9, longest + 2)) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') || 'Report');
  XLSX.writeFile(wb, `${name}.xlsx`);
}


export interface PdfOptions {
 
  subtitle?: string;

  meta?: Array<[string, string]>;
 
  summary?: Array<{ label: string; value: string; tone?: 'ok' | 'warn' | 'danger' }>;

  groups?: Array<{ label: string; span: number }>;
 
  totals?: Array<{ text: string | number; span?: number; align?: 'left' | 'right' | 'center' }>;

  landscape?: boolean;
  
  note?: string;
}

const isNumberText = (v: string | number) => typeof v === 'number' || /^-?[\d,]+(\.\d+)?$/.test(String(v).trim());
const cell = (v: string | number) => htmlEsc(v).replace(/\n/g, '<br>');

function pdfBody<T>(title: string, cols: ExportCol<T>[], rows: T[], o: PdfOptions) {
  const values = rows.map((row) => cols.map((c) => c.value(row)));

  const numeric = cols.map((_, i) => values.length > 0 && values.every((r) => String(r[i]).trim() === '' || isNumberText(r[i])));
  const grouped = !!o.groups?.some((g) => g.label);

  let head = '';
  if (grouped) {
    let at = 0;
    let top = '';
    let bottom = '';
    for (const g of o.groups!) {
      if (!g.label) {
        for (let k = 0; k < g.span; k++) top += `<th rowspan="2" class="${numeric[at + k] ? 'r' : ''}">${htmlEsc(cols[at + k].header)}</th>`;
      } else {
        top += `<th colspan="${g.span}" class="grp">${htmlEsc(g.label)}</th>`;
        for (let k = 0; k < g.span; k++) bottom += `<th class="${numeric[at + k] ? 'r' : ''}">${htmlEsc(cols[at + k].header)}</th>`;
      }
      at += g.span;
    }
    head = `<tr>${top}</tr><tr class="sub">${bottom}</tr>`;
  } else {
    head = `<tr>${cols.map((c, i) => `<th class="${numeric[i] ? 'r' : ''}">${htmlEsc(c.header)}</th>`).join('')}</tr>`;
  }

  const body = values.map((r) => `<tr>${r.map((v, i) => `<td class="${numeric[i] ? 'r' : ''}">${cell(v)}</td>`).join('')}</tr>`).join('');
  const foot = o.totals
    ? `<tr class="total">${o.totals.map((t) => `<td colspan="${t.span ?? 1}" class="${t.align === 'right' || (t.align === undefined && isNumberText(t.text)) ? 'r' : t.align === 'center' ? 'c' : ''}">${cell(t.text)}</td>`).join('')}</tr>`
    : '';
  const empty = `<tr><td colspan="${cols.length}" class="empty">No records in this report.</td></tr>`;

  const chips = (o.meta ?? []).filter(([, v]) => v).map(([k, v]) => `<span class="chip"><b>${htmlEsc(k)}</b>${htmlEsc(v)}</span>`).join('');
  const cards = (o.summary ?? []).map((s) => `<div class="card ${s.tone ?? ''}"><p>${htmlEsc(s.label)}</p><strong>${htmlEsc(s.value)}</strong></div>`).join('');
  const generated = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return `
    <header class="top">
      <div class="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2.5c3.4 4.3 6 7.4 6 10.9A6 6 0 0 1 6 13.4C6 9.9 8.6 6.8 12 2.5Z" fill="#fff"/><path d="M9.9 11.4l4.2 4.2M14.1 11.4l-4.2 4.2" stroke="#2563eb" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>
      </div>
      <div class="ttl">
        <p class="eyebrow">SMARTX · DAIRY PORTAL</p>
        <h1>${htmlEsc(title)}</h1>
        ${o.subtitle ? `<p class="sub">${htmlEsc(o.subtitle)}</p>` : ''}
      </div>
      <div class="stamp"><span>Generated</span><b>${htmlEsc(generated)}</b><span>${rows.length} record${rows.length === 1 ? '' : 's'}</span></div>
    </header>
    ${chips ? `<div class="chips">${chips}</div>` : ''}
    ${cards ? `<div class="cards">${cards}</div>` : ''}
    <div class="tw"><table><thead>${head}</thead><tbody>${body || empty}${rows.length ? foot : ''}</tbody></table></div>
    ${o.note ? `<p class="note">${htmlEsc(o.note)}</p>` : ''}
    <footer><span>SmartX · Data from the SmartX portal</span><span class="pg"></span></footer>
  `;
}

export function exportPDF<T>(title: string, cols: ExportCol<T>[], rows: T[], options: PdfOptions = {}) {
  const report = window.open('', '_blank', 'width=1100,height=760');
  if (!report) return;
  const landscape = options.landscape ?? cols.length > 8;

  report.document.write(`<!doctype html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${htmlEsc(title)}</title>
      <style>
        :root { color-scheme: light; --deep:#0b1a3d; --brand:#2563eb; --light:#60a5fa; --line:#cddbf3; --soft:#f1f5fe; --mute:#5b6b8f; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 28px; color: var(--deep); background: #fff; font: 12px/1.45 Inter, "Segoe UI", ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .top { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding: 18px 22px; color: #fff; border-radius: 16px; border-bottom: 5px solid var(--brand); background: linear-gradient(120deg, #0b1a3d 0%, #1b3771 58%, #2563eb 100%); }
        .logo { display: grid; width: 50px; height: 50px; flex: 0 0 auto; place-items: center; border-radius: 15px; background: linear-gradient(135deg, #2563eb, #60a5fa); box-shadow: 0 4px 12px rgba(37,99,235,.45); }
        .ttl { min-width: 0; flex: 1; }
        .eyebrow { margin: 0 0 3px; color: #93c5fd; font-size: 9.5px; font-weight: 800; letter-spacing: .16em; }
        h1 { margin: 0; font-size: 22px; line-height: 1.2; overflow-wrap: anywhere; }
        .top .sub { margin: 4px 0 0; color: #cfdcff; font-size: 12px; }
        .stamp { display: grid; gap: 1px; text-align: right; font-size: 10px; color: #b4c4e8; white-space: nowrap; }
        .stamp b { color: #fff; font-size: 11.5px; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .chip { padding: 4px 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--soft); font-size: 11px; }
        .chip b { margin-right: 6px; color: var(--brand); font-weight: 700; }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
        .card { padding: 11px 14px; border: 1px solid var(--line); border-left: 4px solid var(--brand); border-radius: 12px; background: #fff; }
        .card.ok { border-left-color: #26a06a; } .card.warn { border-left-color: #e09628; } .card.danger { border-left-color: #da4e4e; }
        .card p { margin: 0; color: var(--mute); font-size: 10.5px; font-weight: 600; }
        .card strong { display: block; margin-top: 2px; font-size: 17px; letter-spacing: -.01em; }
        .tw { overflow-x: auto; border-radius: 12px; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; font-size: 11px; }
        thead { display: table-header-group; }
        th { padding: 9px 9px; color: #fff; background: var(--brand); text-align: left; font-weight: 700; white-space: nowrap; border-right: 1px solid rgba(255,255,255,.18); }
        th.grp { background: var(--deep); text-align: center; font-size: 11.5px; letter-spacing: .02em; }
        tr.sub th { background: #1d4fbf; }
        th.r, td.r { text-align: right; font-variant-numeric: tabular-nums; }
        td.c { text-align: center; }
        td { padding: 7px 9px; border-top: 1px solid var(--line); border-right: 1px solid #e3ebfa; vertical-align: top; }
        tbody tr:nth-child(even) td { background: var(--soft); }
        tr.total td { padding: 10px 9px; border-top: 2px solid var(--brand); background: #e3ecfd !important; font-weight: 800; font-variant-numeric: tabular-nums; }
        td.empty { padding: 28px; text-align: center; color: var(--mute); }
        .note { margin: 12px 0 0; color: var(--mute); font-size: 10.5px; }
        footer { display: flex; justify-content: space-between; margin-top: 18px; padding-top: 9px; border-top: 1px solid var(--line); color: var(--mute); font-size: 10px; }
        @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm 10mm 14mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9px sans-serif; color: #5b6b8f; } }
        @media print { body { padding: 0; } .tw { overflow: visible; } tr { break-inside: avoid; } .top, .cards, .chips { break-inside: avoid; } }
        @media (max-width: 480px) { h1 { font-size: 18px; } .logo { width: 42px; height: 42px; } .cards { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 700px) { body { padding: 14px; } .top { flex-wrap: wrap; } .stamp { text-align: left; } table { font-size: 9px; } }
      </style>
    </head><body>${pdfBody(title, cols, rows, options)}</body></html>`);
  report.document.close();
  report.focus();
  window.setTimeout(() => report.print(), 400);
}