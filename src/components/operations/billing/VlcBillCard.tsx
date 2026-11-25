import type * as React from "react";
import { cn } from "../../../lib/portal/cn";
import type {
  BillSection,
  MilkKind,
  ShiftData,
  VlcBill,
} from "../../../services/billing/vlcMilkBill.api";

/**
 * Show Record look of one VLC milk bill - the SAME layout as the Farmer Bill card:
 * "VLC Name / Date" line, one table (Date | Milk | Morning | Evening) with a bold "Cow | Total" line after
 * every milk type, then the Liter / Amount boxes and the signature lines.
 * (Print Bill / PDF have their own format, see lib/portal/vlcBillPrint.ts.)
 */
const KEYS: Array<keyof ShiftData> = ["wt", "fat", "snf", "clr", "rate", "amt"];
const HEADS = ["Wt", "Fat", "SNF", "CLR", "Rate", "Amt"];
const SHORT: Record<MilkKind, string> = { cow: "Cow", buffalo: "Buff", mix: "Mix" };

const f2 = (x: number) => x.toFixed(2);
const ZERO: ShiftData = { wt: 0, fat: 0, snf: 0, clr: 0, rate: 0, amt: 0 };
const val = (s: ShiftData | null, k: keyof ShiftData) => f2((s ?? ZERO)[k]);

const HEAD = "border border-line bg-soft px-2 py-1.5 text-center font-bold";
const CELL = "border border-line px-2 py-1.5 text-center";

interface Line {
  date: string;
  milk: string;
  m: ShiftData | null;
  e: ShiftData | null;
  total: boolean;
}

function linesOf(b: VlcBill): Line[] {
  const out: Line[] = [];
  for (const s of b.sections) {
    const name = SHORT[s.kind] ?? s.label;
    for (const d of s.days)
      out.push({ date: d.date, milk: name, m: d.m, e: d.e, total: false });
    out.push({ date: name, milk: "Total", m: s.mTotal, e: s.eTotal, total: true });
  }
  return out;
}

const sectionOf = (b: VlcBill, kind: MilkKind): BillSection | undefined =>
  b.sections.find((s) => s.kind === kind);
const literOf = (s?: BillSection) => (s ? s.mTotal.wt + s.eTotal.wt : 0);
const amountOf = (s?: BillSection) => (s ? s.mTotal.amt + s.eTotal.amt : 0);

/** Liter / Amount boxes (4 per row, like the Farmer Bill summary). */
function summaryOf(b: VlcBill): Array<Array<{ label: string; value: string }>> {
  const cow = sectionOf(b, "cow");
  const buf = sectionOf(b, "buffalo");
  const mix = sectionOf(b, "mix");
  return [
    [
      { label: "Cow Liter", value: f2(literOf(cow)) },
      { label: "Buff Liter", value: f2(literOf(buf)) },
      { label: "Mix Liter", value: f2(literOf(mix)) },
      { label: "Total Liter", value: f2(literOf(cow) + literOf(buf) + literOf(mix)) },
    ],
    [
      { label: "Cow Amt", value: f2(amountOf(cow)) },
      { label: "Buff Amount", value: f2(amountOf(buf)) },
      { label: "Mix Amount", value: f2(amountOf(mix)) },
      {
        label: "Total Amount",
        value: f2(amountOf(cow) + amountOf(buf) + amountOf(mix)),
      },
    ],
  ];
}

/** Plain text of a bill - used by the "Search any column" box. */
export function vlcBillText(b: VlcBill): string {
  return [
    b.stationId,
    b.stationName,
    b.from,
    b.to,
    ...linesOf(b).flatMap((l) => [l.date, l.milk]),
    ...summaryOf(b).flat().flatMap((p) => [p.label, p.value]),
  ].join(" ");
}

export const VlcBillCard: React.FC<{ bill: VlcBill }> = ({ bill }) => {
  const label = `${bill.stationId} ${bill.stationName || ""}`.trim();
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-4 py-3 text-sm">
        <p>
          <span className="font-bold">VLC Name:</span>{" "}
          <span className="font-semibold">{label || "—"}</span>
        </p>
        <p>
          <span className="font-bold">Date:</span>{" "}
          <span className="tnum">
            {bill.from} To {bill.to}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto p-3">
        <table className="w-full min-w-[860px] border-collapse text-[13px] tnum">
          <thead>
            <tr>
              <th rowSpan={2} className={HEAD}>
                Date
              </th>
              <th rowSpan={2} className={HEAD}>
                Milk
              </th>
              <th colSpan={6} className={HEAD}>
                Morning
              </th>
              <th colSpan={6} className={HEAD}>
                Evening
              </th>
            </tr>
            <tr>
              {HEADS.map((h) => (
                <th key={`m${h}`} className={cn(HEAD, "font-semibold text-mute")}>
                  {h}
                </th>
              ))}
              {HEADS.map((h) => (
                <th key={`e${h}`} className={cn(HEAD, "font-semibold text-mute")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linesOf(bill).map((d, i) => (
              <tr
                key={`${d.date}${d.milk}${i}`}
                className={d.total ? "bg-soft font-bold" : ""}
              >
                <td className={CELL}>{d.date}</td>
                <td className={CELL}>{d.milk}</td>
                {KEYS.map((k) => (
                  <td key={`m${k}`} className={CELL}>
                    {val(d.m, k)}
                  </td>
                ))}
                {KEYS.map((k) => (
                  <td key={`e${k}`} className={CELL}>
                    {val(d.e, k)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full min-w-[860px] border-collapse text-[13px] tnum">
          <tbody>
            {summaryOf(bill).map((row, i) => (
              <tr key={i}>
                {row.map((p) => {
                  const net = /^total/i.test(p.label);
                  return (
                    <td
                      key={p.label}
                      className={cn(
                        "w-1/4 border border-line px-3 py-1.5",
                        net && "bg-soft",
                      )}
                    >
                      <span className="flex justify-between gap-3">
                        <span className={cn("text-mute", net && "font-bold text-ink")}>
                          {p.label}:
                        </span>
                        <b>{p.value}</b>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 px-4 pb-4 pt-5 text-xs text-mute sm:grid-cols-2">
        <p className="border-t border-dashed border-line pt-1.5 text-center">
          Center Incharge Signature :
        </p>
        <p className="border-t border-dashed border-line pt-1.5 text-center">
          Producer Signature :
        </p>
      </div>
    </article>
  );
};
