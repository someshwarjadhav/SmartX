import type {
  FarmerBillData,
  BillShift,
} from "../../services/billing/farmerBill.api";
import {
  brandImgHtml,
  getBrandLogo,
  loadLogoPixels,
  type BrandLogo,
} from "../brandLogo";

/** Header block of the printed Farmer Bill (dairy name on top, then village / period). */
export interface BillPrintInfo {
  dairy: string;
  villageId: string;
  villageName: string;
  /** e.g. 01-10-2026 */
  from: string;
  to: string;
  /** contact details of the dairy (from the login profile) - shown under the dairy name */
  address?: string;
  phone?: string;
  gst?: string;
}

const KEYS: Array<keyof BillShift> = ["wt", "fat", "snf", "rate", "amt"];
const HEADS = ["Wt", "Fat", "SNF", "Rate", "Amt"];

const esc = (v: string | number) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );

const farmerLabel = (b: FarmerBillData) => `${b.id} ${b.name}`.trim();
const period = (i: BillPrintInfo) => `${i.from} To ${i.to}`;
const contactLine = (i: BillPrintInfo) =>
  [i.phone ? `Ph: ${i.phone}` : "", i.gst ? `GST: ${i.gst}` : ""]
    .filter(Boolean)
    .join("  |  ");

function billHtml(
  b: FarmerBillData,
  i: BillPrintInfo,
  generated: string,
  brand: BrandLogo | null,
  zoom = 1,
): string {
  const rows = b.lines
    .map(
      (l) =>
        `<tr class="${l.total ? "tot" : ""}"><td>${esc(l.label)}</td><td>${esc(l.milk)}</td>${KEYS.map((k) => `<td class="r">${esc(l.m[k])}</td>`).join("")}${KEYS.map((k) => `<td class="r">${esc(l.e[k])}</td>`).join("")}</tr>`,
    )
    .join("");
  const summary = b.summary
    .map(
      (row) =>
        `<tr>${row.map((p, j) => `<td ${j === row.length - 1 && row.length < 4 ? `colspan="${5 - row.length}"` : ""} class="${/net\s*payment/i.test(p.label) ? "net" : ""}"><span>${esc(p.label)}</span><b>${esc(p.value)}</b></td>`).join("")}</tr>`,
    )
    .join("");
  return `
  <section class="bill center"${zoom < 1 ? ` style="--pz:${zoom.toFixed(3)}"` : ""}>
    <header class="top">
      ${brand ? `<div class="logo own">${brandImgHtml(brand, 84, 240)}</div>` : `<div class="logo-sp"></div>`}
      <div class="ttl">
        <p class="eyebrow">${brand ? esc(brand.name.toUpperCase()) : "SMARTX · DAIRY PORTAL"}</p>
        <h1>${esc(i.dairy)}</h1>
        ${i.address ? `<p class="contact">${esc(i.address)}</p>` : ""}
        ${contactLine(i) ? `<p class="contact">${esc(contactLine(i))}</p>` : ""}
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
    <div class="scroll"><table class="main">
      <thead>
        <tr><th rowspan="2">Date</th><th rowspan="2">Milk</th><th colspan="5" class="grp">Morning</th><th colspan="5" class="grp">Evening</th></tr>
        <tr class="sub">${HEADS.map((h) => `<th class="r">${h}</th>`).join("")}${HEADS.map((h) => `<th class="r">${h}</th>`).join("")}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="scroll"><table class="sum"><tbody>${summary}</tbody></table></div>
    <div class="sign"><span>Center Incharge Signature :</span><span>Producer Signature :</span></div>
    <footer><span>${brand ? esc(i.dairy) : "SmartX · Data from the SmartX portal"}</span></footer>
  </section>`;
}

/**
 * Print Bill: the bill opens in a NEW TAB as a normal page (the same content that Show Record shows).
 * Nothing is printed by itself - the print dialog opens only when the person clicks "Print Bill" on that page.
 */
const BILL_CSS = `

    :root { color-scheme: light; --deep:#0b1a3d; --brand:#2563eb; --line:#cddbf3; --soft:#f1f5fe; --mute:#5b6b8f; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; color: var(--deep); background: #fff; font: 12px/1.45 Inter, "Segoe UI", ui-sans-serif, system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* a farmer bill is never split between two pages, and bills are NOT forced onto separate pages:
       as many farmers as fit are packed on one page, the next one moves to the next page */
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
    @page { size: A4 portrait; margin: 10mm; }
    @media print {
      body { padding: 0; font-size: 10px; line-height: 1.3; }
      .bill .scroll { overflow: visible; }
      /* every sheet = one printed page; the farmers on it were chosen in code (see planSheets) */
      .sheet { break-after: page; page-break-after: always; }
      .sheet:last-of-type { break-after: auto; page-break-after: auto; }
      .bill { zoom: var(--pz, 1); width: 164mm; margin: 0 auto; padding: 0 0 8px; border: 0; break-inside: avoid; page-break-inside: avoid; }
      /* two farmers on one page: the spare space of the page is shared between them (gap in the middle) */
      .sheet.two { display: flex; flex-direction: column; height: 272mm; }
      .sheet.two .bill { flex: none; }
      .cut { display: block; width: 164mm; height: 0; margin: auto; border-top: 1px dashed #9db4e6; }
      /* fixed heights: the code knows exactly how tall a bill is, so it can fit it on the page */
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
      table.sum { margin-top: 5px; }
      table.sum td { height: 20px; padding: 0 6px; line-height: 18px; }
      table.sum td.net b { font-size: 11px; }
      /* more room above the line so the center incharge / producer can really sign */
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

/* Printed page = A4 portrait, 10 mm margins -> 277 mm tall = about 1047 px; a little is kept free. */
const SHEET_H = 1010;

/** Height (px) of one bill in the print layout - the sizes are the fixed ones from BILL_CSS. */
function printHeight(b: FarmerBillData): number {
  return (
    70 + 5 + // header
    21 + 6 + // chips
    (2 + b.lines.length) * 16 + 2 + // main table
    5 + b.summary.length * 20 + 2 + // summary table
    34 + 18 + // signature (space to sign + line)
    8 // space under the bill
  );
}

interface Sheet {
  items: Array<{ bill: FarmerBillData; zoom: number }>;
}

/**
 * Decides which farmers go on which page: as many as fit, a farmer is never split;
 * a farmer who is taller than one page is made a little smaller so he still fits on ONE page.
 */
function planSheets(bills: FarmerBillData[]): Sheet[] {
  const sheets: Sheet[] = [];
  let cur: Sheet = { items: [] };
  let used = 0;
  for (const bill of bills) {
    const h = printHeight(bill);
    const zoom = h > SHEET_H ? Math.max(0.45, SHEET_H / h) : 1;
    const eff = h * zoom;
    if (cur.items.length && (cur.items.length >= 2 || used + eff > SHEET_H)) {
      sheets.push(cur);
      cur = { items: [] };
      used = 0;
    }
    cur.items.push({ bill, zoom });
    used += eff;
  }
  if (cur.items.length) sheets.push(cur);
  return sheets;
}

export function printFarmerBills(
  bills: FarmerBillData[],
  info: BillPrintInfo,
  title = "Farmer Bill",
): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  const brand = getBrandLogo();
  const generated = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const count = `${bills.length} farmer bill${bills.length === 1 ? "" : "s"}`;
  w.document
    .write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
  <style>
${BILL_CSS}${PAGE_CSS}  </style></head><body>
  <div class="toolbar">
    <div class="what"><b>${esc(info.dairy)} · Farmer Bill</b>${esc(info.villageName)} · ${esc(period(info))} · ${esc(count)}</div>
    <button type="button" onclick="window.print()">Print Bill</button>
  </div>
  ${planSheets(bills)
    .map(
      (sh) =>
        `<div class="sheet${sh.items.length === 2 ? " two" : ""}">${sh.items
          .map((it) => billHtml(it.bill, info, generated, brand, it.zoom))
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
/*  Download (real PDF file, as many farmer bills per page as fit)     */
/* ------------------------------------------------------------------ */

type Fin = { lastAutoTable: { finalY: number } };

export async function downloadFarmerBills(
  bills: FarmerBillData[],
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
  const M = 62; // left / right margin: the bill box is centred and narrower than the page
  const TOP = 30; // top of every page
  const BOTTOM = H - 30; // nothing is drawn below this line
  const GAP = 16; // space between two bills on the same page
  const line = {
    lineColor: [0, 0, 0] as [number, number, number],
    lineWidth: 0.5,
  };

  // A4 portrait: two 7-day farmer bills fit on one page with room to spare
  const TABLE_FONT = 8;
  const TABLE_PAD = 2.3;
  const SUM_FONT = 8.5;
  const SUM_PAD = 3.2;
  const rowH = TABLE_FONT * 1.15 + TABLE_PAD * 2;
  const sumRowH = SUM_FONT * 1.15 + SUM_PAD * 2;
  const HEADER_H = 66; // dairy name, address / contact, village + farmer lines
  const SIGN_H = 50;

  /** Part of a bill that can be made smaller (the two tables). */
  const flexOf = (b: FarmerBillData) =>
    (2 + b.lines.length) * rowH + b.summary.length * sumRowH;
  /** A farmer taller than one page gets a smaller table (k < 1) so that he still fits on ONE page. */
  const fitOf = (b: FarmerBillData) =>
    Math.min(
      1,
      Math.max(0.5, (BOTTOM - TOP - HEADER_H - SIGN_H - 8) / flexOf(b)),
    );
  /** Height this farmer bill will need (a little extra is kept so it never gets cut). */
  const heightOf = (b: FarmerBillData) =>
    HEADER_H + flexOf(b) * fitOf(b) + SIGN_H + 4;

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

  /** Draws one farmer bill starting at y. Returns the y where it ends. */
  const drawBill = (b: FarmerBillData, y0: number): number => {
    const k = fitOf(b);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(info.dairy, W / 2, y0 + 14, { align: "center" });
    let hy = y0 + 14;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const contact = [info.address, contactLine(info)].filter(Boolean).join("   ");
    if (contact) {
      hy += 11;
      doc.text(contact, W / 2, hy, { align: "center" });
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Farmer Bill", W / 2, hy + 12, { align: "center" });
    if (logo) {
      // own logo of the dairy, top left (keeps its shape)
      const lk = Math.min(110 / logo.w, 40 / logo.h);
      doc.addImage(logo.data, logo.format, M, y0, logo.w * lk, logo.h * lk);
    }

    // village / farmer on the left, village name / period on the right (like the old bill format)
    doc.setFontSize(8.5);
    const iy = y0 + HEADER_H - 14;
    put("Village Id:", info.villageId, M, iy);
    put("Farmer Name:", farmerLabel(b), M, iy + 10);
    put("Village Name:", info.villageName, W - M, iy, "right");
    put("Bill Period:", b.range || period(info), W - M, iy + 10, "right");

    const num = (i: number) => ({
      halign: "center" as const,
      cellWidth: i < 2 ? 54 : ("auto" as const),
    });
    autoTable(doc, {
      startY: y0 + HEADER_H,
      margin: { left: M, right: M, top: TOP, bottom: 14 },
      theme: "grid",
      head: [
        [
          { content: "Date", rowSpan: 2, styles: { valign: "middle" } },
          { content: "Milk", rowSpan: 2, styles: { valign: "middle" } },
          { content: "Morning", colSpan: 5 },
          { content: "Evening", colSpan: 5 },
        ],
        [...HEADS, ...HEADS],
      ],
      body: b.lines.map((l) => [
        l.label,
        l.milk,
        ...KEYS.map((k) => l.m[k]),
        ...KEYS.map((k) => l.e[k]),
      ]),
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
      columnStyles: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i, num(i)]),
      ),
      didParseCell: (d) => {
        if (d.section === "body" && b.lines[d.row.index]?.total)
          d.cell.styles.fontStyle = "bold";
      },
    });

    const afterTable = (doc as unknown as Fin).lastAutoTable.finalY;
    autoTable(doc, {
      startY: afterTable,
      margin: { left: M, right: M, top: TOP, bottom: 14 },
      theme: "grid",
      body: b.summary.map((row) =>
        row.map((p) => ({
          content: `${p.label}: ${p.value}`,
          styles: /net\s*payment/i.test(p.label)
            ? { fillColor: [242, 242, 242] as [number, number, number] }
            : {},
        })),
      ),
      styles: {
        fontSize: SUM_FONT * k,
        cellPadding: SUM_PAD * k,
        halign: "center",
        fontStyle: "bold",
        textColor: 0,
        ...line,
      },
    });

    const y = (doc as unknown as Fin).lastAutoTable.finalY + 30;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setLineDashPattern([2, 2], 0);
    doc.setDrawColor(0);
    doc.line(M, y, W / 2 - 20, y);
    doc.line(W / 2 + 20, y, W - M, y);
    doc.setLineDashPattern([], 0);
    doc.text("Center Incharge Signature :", (M + W / 2 - 20) / 2, y + 11, {
      align: "center",
    });
    doc.text("Producer Signature :", (W / 2 + 20 + W - M) / 2, y + 11, {
      align: "center",
    });
    return y + 14;
  };

  // pages: at most 2 farmers, only if both fit; a bigger farmer is alone on his page
  const pages: FarmerBillData[][] = [];
  let curPage: FarmerBillData[] = [];
  let usedH = 0;
  for (const b of bills) {
    const h = heightOf(b);
    if (curPage.length && (curPage.length >= 2 || usedH + GAP + h > BOTTOM - TOP)) {
      pages.push(curPage);
      curPage = [];
      usedH = 0;
    }
    curPage.push(b);
    usedH += h + (curPage.length > 1 ? GAP : 0);
  }
  if (curPage.length) pages.push(curPage);

  pages.forEach((pg, n) => {
    if (n > 0) doc.addPage();
    const end1 = drawBill(pg[0], TOP);
    if (pg[1]) {
      // the free space of the page goes between the two farmers, with a cut line in the middle of it
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