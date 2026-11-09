import type { FarmerBillData, BillShift } from '../../services/billing/farmerBill.api';

/** Header block of the printed Farmer Bill (dairy name on top, then village / period). */
export interface BillPrintInfo {
  dairy: string;
  villageId: string;
  villageName: string;
  /** e.g. 01-10-2026 */
  from: string;
  to: string;
}

const KEYS: Array<keyof BillShift> = ['wt', 'fat', 'snf', 'rate', 'amt'];
const HEADS = ['Wt', 'Fat', 'SNF', 'Rate', 'Amt'];

const esc = (v: string | number) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const farmerLabel = (b: FarmerBillData) => `${b.id} ${b.name}`.trim();
const period = (i: BillPrintInfo) => `${i.from} To ${i.to}`;

/* ------------------------------------------------------------------ */
/*  Print (browser print dialog - also lets the user "Save as PDF")    */
/* ------------------------------------------------------------------ */

function billHtml(b: FarmerBillData, i: BillPrintInfo, last: boolean, generated: string): string {
  const rows = b.lines
    .map(
      (l) =>
        `<tr class="${l.total ? 'tot' : ''}"><td>${esc(l.label)}</td><td>${esc(l.milk)}</td>${KEYS.map((k) => `<td class="r">${esc(l.m[k])}</td>`).join('')}${KEYS.map((k) => `<td class="r">${esc(l.e[k])}</td>`).join('')}</tr>`,
    )
    .join('');
  const summary = b.summary
    .map((row) => `<tr>${row.map((p, j) => `<td ${j === row.length - 1 && row.length < 4 ? `colspan="${5 - row.length}"` : ''} class="${/net\s*payment/i.test(p.label) ? 'net' : ''}"><span>${esc(p.label)}</span><b>${esc(p.value)}</b></td>`).join('')}</tr>`)
    .join('');
  return `
  <section class="bill" ${last ? 'style="break-after:auto;page-break-after:auto"' : ''}>
    <header class="top">
      <div class="logo" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2.5c3.4 4.3 6 7.4 6 10.9A6 6 0 0 1 6 13.4C6 9.9 8.6 6.8 12 2.5Z" fill="#fff"/><path d="M9.9 11.4l4.2 4.2M14.1 11.4l-4.2 4.2" stroke="#2563eb" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg></div>
      <div class="ttl">
        <p class="eyebrow">SMARTX · DAIRY PORTAL</p>
        <h1>${esc(i.dairy)}</h1>
        <p class="sub">Farmer Bill · ${esc(b.range || period(i))}</p>
      </div>
      <div class="stamp"><span>Generated</span><b>${esc(generated)}</b></div>
    </header>
    <div class="chips">
      <span class="chip"><b>Village Id</b>${esc(i.villageId)}</span>
      <span class="chip"><b>Village Name</b>${esc(i.villageName)}</span>
      <span class="chip"><b>Farmer Name</b>${esc(farmerLabel(b))}</span>
      <span class="chip"><b>Bill Period</b>${esc(b.range || period(i))}</span>
    </div>
    <table class="main">
      <thead>
        <tr><th rowspan="2">Date</th><th rowspan="2">Milk</th><th colspan="5" class="grp">Morning</th><th colspan="5" class="grp">Evening</th></tr>
        <tr class="sub">${HEADS.map((h) => `<th class="r">${h}</th>`).join('')}${HEADS.map((h) => `<th class="r">${h}</th>`).join('')}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="sum"><tbody>${summary}</tbody></table>
    <div class="sign"><span>Center Incharge Signature :</span><span>Producer Signature :</span></div>
    <footer><span>SmartX · Data from the SmartX portal</span></footer>
  </section>`;
}

export function printFarmerBills(bills: FarmerBillData[], info: BillPrintInfo, title = 'Farmer Bill'): boolean {
  const w = window.open('', '_blank', 'width=1100,height=760');
  if (!w) return false;
  const generated = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
  <style>
    :root { color-scheme: light; --deep:#0b1a3d; --brand:#2563eb; --line:#cddbf3; --soft:#f1f5fe; --mute:#5b6b8f; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; color: var(--deep); background: #fff; font: 12px/1.45 Inter, "Segoe UI", ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .bill { break-after: page; page-break-after: always; padding-bottom: 6px; }
    .top { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; padding: 16px 22px; color: #fff; border-radius: 16px; border-bottom: 5px solid var(--brand); background: linear-gradient(120deg, #0b1a3d 0%, #1b3771 58%, #2563eb 100%); }
    .logo { display: grid; width: 48px; height: 48px; flex: 0 0 auto; place-items: center; border-radius: 15px; background: linear-gradient(135deg, #2563eb, #60a5fa); box-shadow: 0 4px 12px rgba(37,99,235,.45); }
    .ttl { min-width: 0; flex: 1; }
    .eyebrow { margin: 0 0 3px; color: #93c5fd; font-size: 9.5px; font-weight: 800; letter-spacing: .16em; }
    h1 { margin: 0; font-size: 22px; line-height: 1.2; }
    .top .sub { margin: 4px 0 0; color: #cfdcff; font-size: 12px; }
    .stamp { display: grid; gap: 1px; text-align: right; font-size: 10px; color: #b4c4e8; white-space: nowrap; }
    .stamp b { color: #fff; font-size: 11.5px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .chip { padding: 4px 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--soft); font-size: 11px; }
    .chip b { margin-right: 6px; color: var(--brand); font-weight: 700; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; font-size: 11px; }
    th { padding: 8px 9px; color: #fff; background: var(--brand); text-align: center; font-weight: 700; border-right: 1px solid rgba(255,255,255,.18); }
    th.grp { background: var(--deep); font-size: 11.5px; letter-spacing: .02em; }
    tr.sub th { background: #1d4fbf; }
    td { padding: 6px 9px; border-top: 1px solid var(--line); border-right: 1px solid #e3ebfa; text-align: center; }
    td.r, th.r { font-variant-numeric: tabular-nums; }
    tbody tr:nth-child(even) td { background: var(--soft); }
    tr.tot td { border-top: 2px solid var(--brand); background: #e3ecfd !important; font-weight: 800; }
    table.sum { margin-top: 12px; }
    table.sum td { width: 25%; padding: 8px 12px; text-align: left; background: #fff !important; }
    table.sum td span { color: var(--mute); font-weight: 600; }
    table.sum td span::after { content: ":"; }
    table.sum td b { float: right; font-variant-numeric: tabular-nums; }
    table.sum td.net { background: #e3ecfd !important; border-top: 2px solid var(--brand); }
    table.sum td.net span { color: var(--deep); font-weight: 800; }
    table.sum td.net b { font-size: 14px; }
    .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 40px; color: var(--mute); font-size: 11px; }
    .sign span { flex: 1; padding-top: 5px; border-top: 1px dashed var(--line); text-align: center; }
    footer { display: flex; justify-content: space-between; margin-top: 14px; padding-top: 8px; border-top: 1px solid var(--line); color: var(--mute); font-size: 10px; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print { body { padding: 0; } tr { break-inside: avoid; } .top, .chips { break-inside: avoid; } }
  </style></head><body>${bills.map((b, n) => billHtml(b, info, n === bills.length - 1, generated)).join('')}</body></html>`);
  w.document.close();
  w.focus();
  window.setTimeout(() => w.print(), 400);
  return true;
}

/* ------------------------------------------------------------------ */
/*  Download (real PDF file, one farmer bill per page)                 */
/* ------------------------------------------------------------------ */

export async function downloadFarmerBills(bills: FarmerBillData[], info: BillPrintInfo, filename: string): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const mod = autoTableMod as unknown as { default: unknown; autoTable?: unknown };
  const autoTable = (typeof mod.default === 'function' ? mod.default : ((mod.default as { default?: unknown } | undefined)?.default ?? mod.autoTable)) as typeof autoTableMod.default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 28;
  const line = { lineColor: [0, 0, 0] as [number, number, number], lineWidth: 0.6 };

  bills.forEach((b, n) => {
    if (n > 0) doc.addPage();
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(info.dairy, W / 2, 40, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Farmer Bill', W / 2, 60, { align: 'center' });

    doc.setFontSize(10);
    const put = (label: string, value: string, x: number, y: number, right = false) => {
      const lw = doc.getTextWidth(`${label} `);
      doc.setFont('helvetica', 'bold');
      const vw = (doc.setFont('helvetica', 'normal'), doc.getTextWidth(value));
      const start = right ? x - lw - vw : x;
      doc.setFont('helvetica', 'bold');
      doc.text(`${label} `, start, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, start + lw, y);
    };
    put('Village Id:', info.villageId, M, 82);
    put('Village Name:', info.villageName, W - M, 82, true);
    put('Farmer Name:', farmerLabel(b), M, 96);
    put('Bill Period:', b.range || period(info), W - M, 96, true);

    const num = (i: number) => ({ halign: 'center' as const, cellWidth: i < 2 ? 54 : 'auto' as const });
    autoTable(doc, {
      startY: 104,
      margin: { left: M, right: M },
      theme: 'grid',
      head: [
        [
          { content: 'Date', rowSpan: 2, styles: { valign: 'middle' } },
          { content: 'Milk', rowSpan: 2, styles: { valign: 'middle' } },
          { content: 'Morning', colSpan: 5 },
          { content: 'Evening', colSpan: 5 },
        ],
        [...HEADS, ...HEADS],
      ],
      body: b.lines.map((l) => [l.label, l.milk, ...KEYS.map((k) => l.m[k]), ...KEYS.map((k) => l.e[k])]),
      styles: { fontSize: 9, cellPadding: 3, halign: 'center', textColor: 0, ...line },
      headStyles: { fillColor: [242, 242, 242], textColor: 0, fontStyle: 'bold', halign: 'center', ...line },
      columnStyles: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i, num(i)])),
      didParseCell: (d) => {
        if (d.section === 'body' && b.lines[d.row.index]?.total) d.cell.styles.fontStyle = 'bold';
      },
    });

    const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    autoTable(doc, {
      startY: afterTable,
      margin: { left: M, right: M },
      theme: 'grid',
      body: b.summary.map((row) => row.map((p) => ({ content: `${p.label}: ${p.value}`, styles: /net\s*payment/i.test(p.label) ? { fillColor: [242, 242, 242] as [number, number, number] } : {} }))),
      styles: { fontSize: 9.5, cellPadding: 5, halign: 'center', fontStyle: 'bold', textColor: 0, ...line },
    });

    const y = Math.min(H - 30, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 56);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setLineDashPattern([2, 2], 0);
    doc.setDrawColor(0);
    doc.line(M, y, W / 2 - 20, y);
    doc.line(W / 2 + 20, y, W - M, y);
    doc.setLineDashPattern([], 0);
    doc.text('Center Incharge Signature :', (M + W / 2 - 20) / 2, y + 13, { align: 'center' });
    doc.text('Producer Signature :', (W / 2 + 20 + W - M) / 2, y + 13, { align: 'center' });
  });

  doc.save(`${filename}.pdf`);
}
