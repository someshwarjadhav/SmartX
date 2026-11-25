import {
  brandImgHtml,
  getBrandLogo,
  loadLogoPixels,
  type BrandLogo,
} from "../brandLogo";
import {
  totalOf,
  type BillSection,
  type ShiftData,
  type VlcBill,
} from "../../services/billing/vlcMilkBill.api";
// farmerBillPrint.ts is NOT changed - only its (already exported) info type is reused here.
import type { BillPrintInfo } from "./farmerBillPrint";

export type { BillPrintInfo };

/**
 * VLC Milk Bill - Print + PDF download in the SAME format as the Farmer Bill (farmerBillPrint.ts):
 * logo | dairy name + address / contact | generated stamp, chips, blue tables, signature lines,
 * as many bills per A4 page as fit (max 2, with a cut line), a bill is never split between two pages
 * (a very tall bill is made a little smaller; only a really huge one continues on the next page).
 * Nothing prints by itself - the print dialog opens only when "Print Bill" is clicked on the new page.
 */

const HEADS = ["Wt", "Fat", "SNF", "CLR", "Rate", "Amt"];
const KEYS: Array<keyof ShiftData> = ["wt", "fat", "snf", "clr", "rate", "amt"];

const esc = (v: string | number) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );

const f2 = (x: number) => x.toFixed(2);
const period = (b: VlcBill) => `${b.from} To ${b.to}`;
const contactLine = (i: BillPrintInfo) =>
  [i.phone ? `Ph: ${i.phone}` : "", i.gst ? `GST: ${i.gst}` : ""]
    .filter(Boolean)
    .join("  |  ");

const shiftCells = (s: ShiftData | null) =>
  KEYS.map((k) => `<td class="r">${s ? f2(s[k]) : ""}</td>`).join("");

function sectionHtml(sec: BillSection): string {
  const days = sec.days
    .map(
      (d) =>
        `<tr><td>${esc(d.date)}</td>${shiftCells(d.m)}${shiftCells(d.e)}</tr>`,
    )
    .join("");
  return `
    <h2 class="milk">${esc(sec.label)}</h2>
    <div class="scroll"><table class="main">
      <thead>
        <tr><th rowspan="2">Date</th><th colspan="6" class="grp">Morning</th><th colspan="6" class="grp">Evening</th></tr>
        <tr class="sub">${HEADS.map((h) => `<th class="r">${h}</th>`).join("")}${HEADS.map((h) => `<th class="r">${h}</th>`).join("")}</tr>
      </thead>
      <tbody>${days}<tr class="tot"><td>Total</td>${shiftCells(sec.mTotal)}${shiftCells(sec.eTotal)}</tr></tbody>
    </table></div>`;
}

/** Milk-wise summary (+ Grand Total when there is more than one milk type). */
function summaryRows(b: VlcBill): Array<{ label: string; t: ShiftData; total: boolean }> {
  const per = b.sections.map((s) => ({
    label: s.label,
    t: totalOf([s.mTotal, s.eTotal]),
    total: false,
  }));
  if (per.length > 1)
    per.push({
      label: "Grand Total",
      t: totalOf(per.map((p) => p.t)),
      total: true,
    });
  return per;
}

function summaryHtml(b: VlcBill): string {
  const rows = summaryRows(b)
    .map(
      (r) =>
        `<tr class="${r.total ? "tot" : ""}"><td>${esc(r.label)}</td><td class="r">${f2(r.t.wt)}</td><td class="r">${f2(r.t.fat)}</td><td class="r">${f2(r.t.snf)}</td><td class="r">${f2(r.t.rate)}</td><td class="r">${f2(r.t.amt)}</td></tr>`,
    )
    .join("");
  return `
    <h2 class="milk">Summary</h2>
    <div class="scroll"><table class="main smry">
      <thead><tr><th>Milk</th><th class="r">Weight</th><th class="r">Avg Fat</th><th class="r">Avg SNF</th><th class="r">Avg Rate</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function billHtml(
  b: VlcBill,
  i: BillPrintInfo,
  generated: string,
  brand: BrandLogo | null,
  zoom = 1,
  long = false,
): string {
  return `
  <section class="bill center${long ? " long" : ""}"${zoom < 1 ? ` style="--pz:${zoom.toFixed(3)}"` : ""}>
    <header class="top">
      ${brand ? `<div class="logo own">${brandImgHtml(brand, 84, 240)}</div>` : `<div class="logo-sp"></div>`}
      <div class="ttl">
        <p class="eyebrow">${brand ? esc(brand.name.toUpperCase()) : "SMARTX · DAIRY PORTAL"}</p>
        <h1>${esc(i.dairy)}</h1>
        ${i.address ? `<p class="contact">${esc(i.address)}</p>` : ""}
        ${contactLine(i) ? `<p class="contact">${esc(contactLine(i))}</p>` : ""}
        <p class="sub">VLC Milk Bill · ${esc(period(b))}</p>
      </div>
      <div class="stamp"><span>Generated</span><b>${esc(generated)}</b></div>
    </header>
    <div class="chips">
      <span class="chip"><b>VLC Id</b>${esc(b.stationId)}</span>
      <span class="chip"><b>VLC Name</b>${esc(b.stationName || "-")}</span>
      <span class="chip"><b>Bill Period</b>${esc(period(b))}</span>
    </div>
    ${b.sections.map(sectionHtml).join("")}
    ${summaryHtml(b)}
    <div class="sign"><span>Center Incharge Signature :</span><span>Producer Signature :</span></div>
    <footer><span>${brand ? esc(i.dairy) : "SmartX · Data from the SmartX portal"}</span></footer>
  </section>`;
}

/* ---- CSS: the Farmer Bill CSS (copied 1:1, farmerBillPrint.ts keeps its own copy) + the VLC additions ---- */

const BILL_CSS = `

    :root { color-scheme: light; --deep:#0b1a3d; --brand:#2563eb; --line:#cddbf3; --soft:#f1f5fe; --mute:#5b6b8f; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; color: var(--deep); background: #fff; font: 12px/1.45 Inter, "Segoe UI", ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .bill { padding-bottom: 6px; }
    .top { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; padding: 16px 22px; color: var(--deep); border-radius: 16px; border: 1px solid #bcd0f7; border-bottom: 4px solid var(--brand); background: linear-gradient(120deg, #eaf1ff 0%, #dbe8ff 60%, #cfe0ff 100%); }
    .logo { display: grid; width: 48px; height: 48px; flex: 0 0 auto; place-items: center; border-radius: 15px; background: linear-gradient(135deg, #2563eb, #60a5fa); box-shadow: 0 4px 12px rgba(37,99,235,.45); }
    .logo.own { width: auto; min-width: 0; height: auto; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
    .ttl { min-width: 0; flex: 1; }
    .top img.brandlogo { mix-blend-mode: multiply; }
    .bill.center .top { display: grid; grid-template-columns: 1fr auto 1fr; }
    .bill.center .ttl { text-align: center; }
    .bill.center .logo { justify-self: start; }
    .bill.center .stamp { justify-self: end; }
    .eyebrow { margin: 0 0 3px; color: var(--brand); font-size: 9.5px; font-weight: 800; letter-spacing: .16em; }
    h1 { margin: 0; font-size: 22px; line-height: 1.2; }
    .top .sub { margin: 4px 0 0; color: var(--mute); font-size: 12px; }
    .top .contact { margin: 3px 0 0; color: var(--deep); font-size: 12px; font-weight: 600; }
    .stamp { display: grid; gap: 1px; text-align: right; font-size: 10px; color: var(--mute); white-space: nowrap; }
    .stamp b { color: var(--deep); font-size: 11.5px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .chip { padding: 4px 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--soft); font-size: 11px; }
    .chip b { margin-right: 6px; color: var(--brand); font-weight: 700; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; font-size: 11px; }
    th { padding: 8px 9px; color: #fff; background: var(--brand); text-align: center; font-weight: 700; border-right: 1px solid rgba(255,255,255,.18); }
    th.grp { background: #1d4fbf; font-size: 11.5px; letter-spacing: .02em; }
    tr.sub th { background: #3b82f6; }
    td { padding: 6px 9px; border-top: 1px solid var(--line); border-right: 1px solid #e3ebfa; text-align: center; }
    td.r, th.r { font-variant-numeric: tabular-nums; }
    tbody tr:nth-child(even) td { background: var(--soft); }
    tr.tot td { border-top: 2px solid var(--brand); background: #e3ecfd !important; font-weight: 800; }
    .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 40px; color: var(--mute); font-size: 11px; }
    .sign span { flex: 1; padding-top: 5px; border-top: 1px dashed var(--line); text-align: center; }
    footer { display: flex; justify-content: space-between; margin-top: 14px; padding-top: 8px; border-top: 1px solid var(--line); color: var(--mute); font-size: 10px; }
    @page { size: A4 portrait; margin: 10mm; }
    @media print {
      body { padding: 0; font-size: 10px; line-height: 1.3; }
      .bill .scroll { overflow: visible; }
      .sheet { break-after: page; page-break-after: always; }
      .sheet:last-of-type { break-after: auto; page-break-after: auto; }
      .bill { zoom: var(--pz, 1); width: 164mm; margin: 0 auto; padding: 0 0 8px; border: 0; break-inside: avoid; page-break-inside: avoid; }
      .sheet.two { display: flex; flex-direction: column; height: 272mm; }
      .sheet.two .bill { flex: none; }
      .cut { display: block; width: 164mm; height: 0; margin: auto; border-top: 1px dashed #9db4e6; }
      .top { height: 70px; margin-bottom: 5px; padding: 2px 12px; border-radius: 8px; border-bottom-width: 3px; overflow: hidden; }
      .top img.brandlogo { height: 40px !important; max-width: 120px !important; }
      .eyebrow { display: none; }
      h1 { font-size: 16px; line-height: 19px; }
      .top .sub { margin: 1px 0 0; font-size: 10px; line-height: 12px; }
      .top .contact { margin: 0; font-size: 9.5px; line-height: 12px; }
      .stamp { font-size: 8px; }
      .stamp b { font-size: 9px; }
      .chips { flex-wrap: nowrap; gap: 4px; height: 21px; margin-bottom: 6px; overflow: hidden; }
      .chip { padding: 1px 6px; font-size: 8.5px; line-height: 17px; white-space: nowrap; }
      table { font-size: 10px; border-radius: 6px; }
      th, td { height: 16px; padding: 0 3px; line-height: 14px; white-space: nowrap; }
      .sign { height: 18px; margin-top: 34px; gap: 28px; font-size: 10px; line-height: 14px; color: #3b4a6b; }
      .sign span { padding-top: 3px; border-top: 1px dashed #5b6b8f; }
      footer { display: none; }
    }
`;

const PAGE_CSS = `
    .toolbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin: -24px -24px 18px; padding: 10px 24px; background: #fff; border-bottom: 1px solid var(--line); box-shadow: 0 2px 10px rgba(11,26,61,.08); }
    .toolbar .what { min-width: 0; color: var(--mute); font-size: 12px; }
    .toolbar .what b { display: block; color: var(--deep); font-size: 14px; }
    .toolbar button { cursor: pointer; padding: 9px 20px; border: 1px solid var(--line); border-radius: 10px; background: #fff; color: var(--deep); font: 700 13px Inter, "Segoe UI", sans-serif; }
    .toolbar button:hover { border-color: var(--brand); }
    .scroll { overflow-x: auto; }
    .scroll table { min-width: 760px; }
    @media screen { .cut { display: none; } body { zoom: var(--fit, 1); } .bill { max-width: 1180px; margin: 0 auto 22px; padding: 18px; border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 6px 22px rgba(11,26,61,.08); } body { background: #eef3fc; } }
    @media (max-width: 700px) { body { padding: 12px; } .toolbar { margin: -12px -12px 14px; padding: 10px 12px; } .top { flex-wrap: wrap; } .stamp { text-align: left; } .bill.center .top { display: flex; } .bill.center .ttl { text-align: left; } }
    @media print { .toolbar { display: none !important; } .scroll { overflow: visible; } .scroll table { min-width: 0; } }
`;

/* VLC needs 13 columns (Date + 6 + 6, with CLR) and several milk tables, so a little more width / smaller cells */
const VLC_CSS = `
    h2.milk { margin: 14px 0 6px; color: var(--brand); font-size: 13px; font-weight: 800; letter-spacing: .02em; }
    table.smry { max-width: 640px; }
    @media print {
      .bill { width: 184mm; }
      .cut { width: 184mm; }
      /* a bill that is taller than one page even when shrunk may continue on the next page (heading repeats) */
      .bill.long { break-inside: auto; page-break-inside: auto; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      thead { display: table-header-group; }
      h2.milk { height: 16px; margin: 4px 0 2px; font-size: 10.5px; line-height: 16px; break-after: avoid; page-break-after: avoid; }
      table { font-size: 9.5px; }
      th, td { padding: 0 2px; }
      table.smry { max-width: none; }
    }
`;

/* Printed page = A4 portrait, 10 mm margins -> 277 mm tall = about 1047 px; a little is kept free. */
const SHEET_H = 1010;
const MIN_ZOOM = 0.45;
const ROW = 16;

/** Height (px) of one VLC bill in the print layout - the sizes are the fixed ones from the CSS above. */
function printHeight(b: VlcBill): number {
  const sections = b.sections.reduce(
    (a, s) => a + (16 + 4 + 2) + (3 + s.days.length) * ROW + 2,
    0,
  );
  const summary = 22 + (1 + summaryRows(b).length) * ROW + 2;
  return (
    70 + 5 + // header
    21 + 6 + // chips
    sections +
    summary +
    34 + 18 + // signature (space to sign + line)
    8 // space under the bill
  );
}

interface Sheet {
  items: Array<{ bill: VlcBill; zoom: number; long: boolean }>;
}

/** Which VLC bills go on which page: as many as fit (max 2), a bill is never split unless it is huge. */
function planSheets(bills: VlcBill[]): Sheet[] {
  const sheets: Sheet[] = [];
  let cur: Sheet = { items: [] };
  let used = 0;
  for (const bill of bills) {
    const h = printHeight(bill);
    const zoom = h > SHEET_H ? Math.max(MIN_ZOOM, SHEET_H / h) : 1;
    const long = h * zoom > SHEET_H;
    const eff = h * zoom;
    if (cur.items.length && (long || cur.items.length >= 2 || used + eff > SHEET_H)) {
      sheets.push(cur);
      cur = { items: [] };
      used = 0;
    }
    cur.items.push({ bill, zoom, long });
    used += eff;
    if (long) {
      sheets.push(cur);
      cur = { items: [] };
      used = 0;
    }
  }
  if (cur.items.length) sheets.push(cur);
  return sheets;
}

export function printVlcBills(
  bills: VlcBill[],
  info: BillPrintInfo,
  title = "VLC Milk Bill",
): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  const brand = getBrandLogo();
  const generated = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const count = `${bills.length} VLC bill${bills.length === 1 ? "" : "s"}`;
  w.document
    .write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
  <style>
${BILL_CSS}${PAGE_CSS}${VLC_CSS}  </style></head><body>
  <div class="toolbar">
    <div class="what"><b>${esc(info.dairy)} · VLC Milk Bill</b>${esc(info.from)} To ${esc(info.to)} · ${esc(count)}</div>
    <button type="button" onclick="window.print()">Print Bill</button>
  </div>
  ${planSheets(bills)
    .map(
      (sh) =>
        `<div class="sheet${sh.items.length === 2 ? " two" : ""}">${sh.items
          .map((it) =>
            billHtml(it.bill, info, generated, brand, it.zoom, it.long),
          )
          .join('<div class="cut"></div>')}</div>`,
    )
    .join("")}
  <script>
    /* The browser keeps its own zoom level for this tab (often 70-80%). A page cannot set that zoom,
       so the sheet is scaled up by the same amount on screen - it then looks like 100% straight away.
       Printing is not affected (the scale is only applied for screen). */
    (function () {
      function fit() {
        var z = window.outerWidth && window.innerWidth ? window.outerWidth / window.innerWidth : 1;
        var f = z > 0.3 && z < 0.97 ? 1 / z : 1;
        document.documentElement.style.setProperty("--fit", f.toFixed(3));
      }
      fit();
      window.addEventListener("resize", fit);
    })();
  </script></body></html>`);
  w.document.close();
  w.focus();
  return true;
}

/* ------------------------------------------------------------------ */
/*  Download (real PDF file, as many VLC bills per page as fit)        */
/* ------------------------------------------------------------------ */

type Fin = { lastAutoTable: { finalY: number } };

export async function downloadVlcBills(
  bills: VlcBill[],
  info: BillPrintInfo,
  filename: string,
): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const mod = autoTableMod as unknown as {
    default: unknown;
    autoTable?: unknown;
  };
  const autoTable = (
    typeof mod.default === "function"
      ? mod.default
      : ((mod.default as { default?: unknown } | undefined)?.default ??
        mod.autoTable)
  ) as typeof autoTableMod.default;

  const logo = await loadLogoPixels(getBrandLogo());
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36; // left / right margin (13 columns need the width)
  const TOP = 30;
  const BOTTOM = H - 30;
  const GAP = 16;
  const line = {
    lineColor: [0, 0, 0] as [number, number, number],
    lineWidth: 0.5,
  };

  const TABLE_FONT = 7.5;
  const TABLE_PAD = 2;
  const SUM_FONT = 8;
  const SUM_PAD = 2.6;
  const rowH = TABLE_FONT * 1.15 + TABLE_PAD * 2;
  const sumRowH = SUM_FONT * 1.15 + SUM_PAD * 2;
  const HEADER_H = 66;
  const SIGN_H = 50;
  const TITLE_H = 20; // milk name above every table
  const MIN_K = 0.65;

  const summaryOf = (b: VlcBill) => summaryRows(b);
  /** Part of a bill that can be made smaller (the tables). */
  const flexOf = (b: VlcBill) =>
    b.sections.reduce((a, s) => a + (3 + s.days.length) * rowH, 0) +
    (1 + summaryOf(b).length) * sumRowH;
  const fixedOf = (b: VlcBill) =>
    HEADER_H + SIGN_H + 4 + (b.sections.length + 1) * TITLE_H;
  const rawFit = (b: VlcBill) => (BOTTOM - TOP - fixedOf(b)) / flexOf(b);
  /** too tall for one page even when smaller: it keeps a readable size and continues on the next page */
  const multiOf = (b: VlcBill) => rawFit(b) < MIN_K;
  const fitOf = (b: VlcBill) =>
    multiOf(b) ? 0.9 : Math.min(1, rawFit(b));
  const heightOf = (b: VlcBill) =>
    multiOf(b) ? BOTTOM - TOP : fixedOf(b) + flexOf(b) * fitOf(b);

  const put = (
    label: string,
    value: string,
    x: number,
    y: number,
    align: "left" | "center" | "right" = "left",
  ) => {
    doc.setFont("helvetica", "bold");
    const lw = doc.getTextWidth(`${label} `);
    doc.setFont("helvetica", "normal");
    const vw = doc.getTextWidth(value);
    const total = lw + vw;
    const start =
      align === "right" ? x - total : align === "center" ? x - total / 2 : x;
    doc.setFont("helvetica", "bold");
    doc.text(`${label} `, start, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, start + lw, y);
  };

  const shiftRow = (s: ShiftData | null) =>
    KEYS.map((k) => (s ? f2(s[k]) : ""));

  /** Draws one VLC bill starting at y. Returns the y where it ends (on its last page). */
  const drawBill = (b: VlcBill, y0: number): number => {
    const k = fitOf(b);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(info.dairy, W / 2, y0 + 14, { align: "center" });
    let hy = y0 + 14;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const contact = [info.address, contactLine(info)]
      .filter(Boolean)
      .join("   ");
    if (contact) {
      hy += 11;
      doc.text(contact, W / 2, hy, { align: "center" });
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("VLC Milk Bill", W / 2, hy + 12, { align: "center" });
    if (logo) {
      const lk = Math.min(110 / logo.w, 40 / logo.h);
      doc.addImage(logo.data, logo.format, M, y0, logo.w * lk, logo.h * lk);
    }

    doc.setFontSize(8.5);
    const iy = y0 + HEADER_H - 14;
    put("VLC Id:", b.stationId, M, iy);
    put("VLC Name:", b.stationName || "-", M, iy + 10);
    put("Bill Period:", period(b), W - M, iy, "right");

    let y = y0 + HEADER_H;

    const columnStyles = Object.fromEntries(
      Array.from({ length: 13 }, (_, i) => [
        i,
        {
          halign: "center" as const,
          cellWidth: i === 0 ? 50 : ("auto" as const),
        },
      ]),
    );

    for (const sec of b.sections) {
      if (y + TITLE_H + 3 * rowH * k > BOTTOM) {
        doc.addPage();
        y = TOP;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(sec.label, M, y + 11);
      autoTable(doc, {
        startY: y + TITLE_H - 6,
        margin: { left: M, right: M, top: TOP, bottom: 14 },
        theme: "grid",
        head: [
          [
            { content: "Date", rowSpan: 2, styles: { valign: "middle" } },
            { content: "Morning", colSpan: 6 },
            { content: "Evening", colSpan: 6 },
          ],
          [...HEADS, ...HEADS],
        ],
        body: [
          ...sec.days.map((d) => [d.date, ...shiftRow(d.m), ...shiftRow(d.e)]),
          ["Total", ...shiftRow(sec.mTotal), ...shiftRow(sec.eTotal)],
        ],
        styles: {
          fontSize: TABLE_FONT * k,
          cellPadding: TABLE_PAD * k,
          halign: "center",
          textColor: 0,
          ...line,
        },
        headStyles: {
          fillColor: [242, 242, 242],
          textColor: 0,
          fontStyle: "bold",
          halign: "center",
          ...line,
        },
        columnStyles,
        didParseCell: (d) => {
          if (d.section === "body" && d.row.index === sec.days.length) {
            d.cell.styles.fontStyle = "bold";
            d.cell.styles.fillColor = [242, 242, 242];
          }
        },
      });
      y = (doc as unknown as Fin).lastAutoTable.finalY + 6;
    }

    // milk-wise summary
    if (y + TITLE_H + 2 * sumRowH * k > BOTTOM) {
      doc.addPage();
      y = TOP;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Summary", M, y + 11);
    autoTable(doc, {
      startY: y + TITLE_H - 6,
      margin: { left: M, right: M, top: TOP, bottom: 14 },
      theme: "grid",
      head: [["Milk", "Weight", "Avg Fat", "Avg SNF", "Avg Rate", "Amount"]],
      body: summaryOf(b).map((r) => [
        r.label,
        f2(r.t.wt),
        f2(r.t.fat),
        f2(r.t.snf),
        f2(r.t.rate),
        f2(r.t.amt),
      ]),
      styles: {
        fontSize: SUM_FONT * k,
        cellPadding: SUM_PAD * k,
        halign: "center",
        textColor: 0,
        ...line,
      },
      headStyles: {
        fillColor: [242, 242, 242],
        textColor: 0,
        fontStyle: "bold",
        halign: "center",
        ...line,
      },
      didParseCell: (d) => {
        if (d.section === "body" && summaryOf(b)[d.row.index]?.total) {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.fillColor = [242, 242, 242];
        }
      },
    });

    let sy = (doc as unknown as Fin).lastAutoTable.finalY + 30;
    if (sy + 14 > BOTTOM) {
      doc.addPage();
      sy = TOP + 30;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setLineDashPattern([2, 2], 0);
    doc.setDrawColor(0);
    doc.line(M, sy, W / 2 - 20, sy);
    doc.line(W / 2 + 20, sy, W - M, sy);
    doc.setLineDashPattern([], 0);
    doc.text("Center Incharge Signature :", (M + W / 2 - 20) / 2, sy + 11, {
      align: "center",
    });
    doc.text("Producer Signature :", (W / 2 + 20 + W - M) / 2, sy + 11, {
      align: "center",
    });
    return sy + 14;
  };

  // pages: at most 2 VLC bills, only if both fit; a bigger bill is alone on its page(s)
  const pages: VlcBill[][] = [];
  let curPage: VlcBill[] = [];
  let usedH = 0;
  for (const b of bills) {
    const h = heightOf(b);
    if (
      curPage.length &&
      (multiOf(b) || curPage.length >= 2 || usedH + GAP + h > BOTTOM - TOP)
    ) {
      pages.push(curPage);
      curPage = [];
      usedH = 0;
    }
    curPage.push(b);
    usedH += h + (curPage.length > 1 ? GAP : 0);
    if (multiOf(b)) {
      pages.push(curPage);
      curPage = [];
      usedH = 0;
    }
  }
  if (curPage.length) pages.push(curPage);

  pages.forEach((pg, n) => {
    if (n > 0) doc.addPage();
    const end1 = drawBill(pg[0], TOP);
    if (pg[1]) {
      const free = Math.max(
        GAP,
        BOTTOM - TOP - heightOf(pg[0]) - heightOf(pg[1]),
      );
      const gap = Math.max(GAP, free / 2);
      doc.setDrawColor(150);
      doc.setLineDashPattern([3, 3], 0);
      doc.line(M, end1 + gap / 2, W - M, end1 + gap / 2);
      doc.setLineDashPattern([], 0);
      drawBill(pg[1], end1 + gap);
    }
  });

  doc.save(`${filename}.pdf`);
}

