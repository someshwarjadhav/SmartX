import type { BillDay, BillSection, ShiftData, VlcBill } from "../../services/billing/vlcMilkBill.api";
import { totalOf } from "../../services/billing/vlcMilkBill.api";
import { brandImgHtml, getBrandLogo } from "../brandLogo";
import type { BillPrintInfo } from "./farmerBillPrint";

/**
 * On-screen HTML of one VLC milk bill (Show Record), in the same look as the printed Farmer Bill format:
 * blue header with logo / dairy name / contact, chips, blue tables, signature lines.
 * Inline styles only (so it does not depend on any page CSS). Every value is escaped.
 */
const esc = (v: string | number) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

const f2 = (x: number) => x.toFixed(2);

const DEEP = "#0b1a3d";
const BRAND = "#2563eb";
const LINE = "#cddbf3";
const SOFT = "#f1f5fe";
const MUTE = "#5b6b8f";

const TH = `padding:7px 8px;color:#fff;background:${BRAND};text-align:center;font-weight:700;white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)`;
const THG = `padding:7px 8px;color:#fff;background:#1d4fbf;text-align:center;font-weight:700;white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)`;
const THS = `padding:6px 8px;color:#fff;background:#3b82f6;text-align:center;font-weight:700;white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)`;
const tdBase = (i: number) =>
  `padding:5px 8px;text-align:center;white-space:nowrap;border-top:1px solid ${LINE};border-right:1px solid #e3ebfa;${i % 2 ? `background:${SOFT};` : ""}`;
const TOT = `padding:6px 8px;text-align:center;white-space:nowrap;font-weight:800;border-top:2px solid ${BRAND};border-right:1px solid #e3ebfa;background:#e3ecfd`;
const TABLE = `width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${LINE};border-radius:12px;overflow:hidden;font-size:12px;font-variant-numeric:tabular-nums`;

const HEADS = ["Wt", "Fat", "SNF", "CLR", "Rate", "Amt"];

const cells = (s: ShiftData | null, style: string): string =>
  s
    ? [f2(s.wt), f2(s.fat), f2(s.snf), f2(s.clr), f2(s.rate), f2(s.amt)]
        .map((v) => `<td style="${style}">${v}</td>`)
        .join("")
    : HEADS.map(() => `<td style="${style}"></td>`).join("");

const dayRow = (d: BillDay, i: number) =>
  `<tr><td style="${tdBase(i)}">${esc(d.date)}</td>${cells(d.m, tdBase(i))}${cells(d.e, tdBase(i))}</tr>`;

function sectionHtml(sec: BillSection): string {
  const head =
    `<tr><th rowspan="2" style="${TH}">Date</th>` +
    `<th colspan="6" style="${THG}">Morning</th><th colspan="6" style="${THG}">Evening</th></tr>` +
    `<tr>${HEADS.map((h) => `<th style="${THS}">${h}</th>`).join("")}${HEADS.map((h) => `<th style="${THS}">${h}</th>`).join("")}</tr>`;
  const total = `<tr><td style="${TOT}">Total</td>${cells(sec.mTotal, TOT)}${cells(sec.eTotal, TOT)}</tr>`;
  return (
    `<h3 style="margin:14px 0 6px;font-size:13px;font-weight:800;color:${BRAND}">${esc(sec.label)}</h3>` +
    `<div style="overflow-x:auto"><table style="${TABLE};min-width:760px"><thead>${head}</thead>` +
    `<tbody>${sec.days.map(dayRow).join("")}${total}</tbody></table></div>`
  );
}

const chip = (label: string, value: string) =>
  `<span style="padding:4px 11px;border:1px solid ${LINE};border-radius:999px;background:${SOFT};font-size:11px"><b style="margin-right:6px;color:${BRAND};font-weight:700">${esc(label)}</b>${esc(value)}</span>`;

export function vlcBillHtml(
  b: VlcBill,
  info?: Pick<BillPrintInfo, "dairy" | "address" | "phone" | "gst">,
): string {
  const all = b.sections.map((s) => totalOf([s.mTotal, s.eTotal]));
  const grand = totalOf(all);
  const period = `${b.from} To ${b.to}`;
  const brand = getBrandLogo();
  const contact = [
    info?.phone ? `Ph: ${info.phone}` : "",
    info?.gst ? `GST: ${info.gst}` : "",
  ]
    .filter(Boolean)
    .join("  |  ");

  const sumRow = (label: string, t: ShiftData, style: string, first = style) =>
    `<tr><td style="${first}">${esc(label)}</td><td style="${style}">${f2(t.wt)}</td><td style="${style}">${f2(t.fat)}</td><td style="${style}">${f2(t.snf)}</td><td style="${style}">${f2(t.rate)}</td><td style="${style}">${f2(t.amt)}</td></tr>`;
  const summary =
    `<h3 style="margin:14px 0 6px;font-size:13px;font-weight:800;color:${BRAND}">Summary</h3>` +
    `<div style="overflow-x:auto"><table style="${TABLE};max-width:640px;min-width:340px"><thead><tr>` +
    ["Milk", "Weight", "Avg Fat", "Avg SNF", "Avg Rate", "Amount"]
      .map((h) => `<th style="${TH}">${h}</th>`)
      .join("") +
    `</tr></thead><tbody>` +
    b.sections.map((s, i) => sumRow(s.label, all[i]!, tdBase(i))).join("") +
    (b.sections.length > 1 ? sumRow("Grand Total", grand, TOT) : "") +
    `</tbody></table></div>`;

  const header =
    `<div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;margin-bottom:14px;padding:16px 22px;border-radius:16px;border:1px solid #bcd0f7;border-bottom:4px solid ${BRAND};background:linear-gradient(120deg,#eaf1ff 0%,#dbe8ff 60%,#cfe0ff 100%);color:${DEEP}">` +
    `<div style="justify-self:start;mix-blend-mode:multiply">${brand ? brandImgHtml(brand, 60, 180) : ""}</div>` +
    `<div style="text-align:center;min-width:0">` +
    `<p style="margin:0 0 3px;color:${BRAND};font-size:9.5px;font-weight:800;letter-spacing:.16em">${brand ? esc(brand.name.toUpperCase()) : "SMARTX · DAIRY PORTAL"}</p>` +
    (info?.dairy
      ? `<h2 style="margin:0;font-size:20px;line-height:1.2;font-weight:800">${esc(info.dairy)}</h2>`
      : "") +
    (info?.address ? `<p style="margin:3px 0 0;font-size:12px;font-weight:600">${esc(info.address)}</p>` : "") +
    (contact ? `<p style="margin:3px 0 0;font-size:12px;font-weight:600">${esc(contact)}</p>` : "") +
    `<p style="margin:4px 0 0;color:${MUTE};font-size:12px">VLC Milk Bill · ${esc(period)}</p>` +
    `</div><div></div></div>`;

  const chips =
    `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">` +
    chip("VLC Id", b.stationId) +
    chip("VLC Name", b.stationName || "-") +
    chip("Bill Period", period) +
    `</div>`;

  const sign =
    `<div style="display:flex;justify-content:space-between;gap:40px;margin-top:40px;color:${MUTE};font-size:11px">` +
    `<span style="flex:1;padding-top:5px;border-top:1px dashed ${LINE};text-align:center">Center Incharge Signature :</span>` +
    `<span style="flex:1;padding-top:5px;border-top:1px dashed ${LINE};text-align:center">Producer Signature :</span></div>`;

  return `<div>${header}${chips}${b.sections.map(sectionHtml).join("")}${summary}${sign}</div>`;
}