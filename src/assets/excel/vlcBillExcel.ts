import { exportExcel, type ExportCol } from "./portalExport";
import { totalOf, type ShiftData, type VlcBill } from "../../services/billing/vlcMilkBill.api";

/**
 * VLC milk bill as a real .xlsx (same style as the Farmer Bill Excel: one header row, one line per day,
 * the VLC written on every line so filter / sort / pivot work, bold-free plain numbers).
 * Every milk type ends with a "Total" line, every VLC with a "Grand Total" line.
 */
interface Line {
  vlc: string;
  milk: string;
  date: string;
  m: ShiftData | null;
  e: ShiftData | null;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const vlcLabel = (b: VlcBill) => `${b.stationId}${b.stationName ? ` · ${b.stationName}` : ""}`;

export function vlcBillLines(bills: VlcBill[]): Line[] {
  const out: Line[] = [];
  for (const b of bills) {
    const vlc = vlcLabel(b);
    for (const s of b.sections) {
      for (const d of s.days) out.push({ vlc, milk: s.label, date: d.date, m: d.m, e: d.e });
      out.push({ vlc, milk: s.label, date: "Total", m: s.mTotal, e: s.eTotal });
    }
    if (b.sections.length > 1)
      out.push({
        vlc,
        milk: "All Milk",
        date: "Grand Total",
        m: totalOf(b.sections.map((s) => s.mTotal)),
        e: totalOf(b.sections.map((s) => s.eTotal)),
      });
  }
  return out;
}

const KEYS: Array<keyof ShiftData> = ["wt", "fat", "snf", "clr", "rate", "amt"];
const HEADS = ["Wt", "Fat", "SNF", "CLR", "Rate", "Amt"];

const shiftCols = (side: "m" | "e", prefix: string): Array<ExportCol<Line>> =>
  KEYS.map((k, i) => ({
    header: `${prefix} ${HEADS[i]}`,
    value: (l) => {
      const s = l[side];
      return s ? r2(s[k]) : "";
    },
  }));

export const VLC_BILL_COLS: Array<ExportCol<Line>> = [
  { header: "VLC", value: (l) => l.vlc },
  { header: "Milk", value: (l) => l.milk },
  { header: "Date", value: (l) => l.date },
  ...shiftCols("m", "Morning"),
  ...shiftCols("e", "Evening"),
];

export function exportVlcBillExcel(name: string, bills: VlcBill[]): Promise<void> {
  // the Total / Grand Total lines are written above, so the generic "Total" row is switched off
  return exportExcel(name, VLC_BILL_COLS, vlcBillLines(bills), { total: false });
}