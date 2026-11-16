import type * as React from "react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, CircleX, Search } from "lucide-react";
import { Modal } from "../../components/operations/ui/Modal";
import { useCentreOptions } from "../../hooks/useCentres";
import { useVlccDirectory } from "../../hooks/useVlccDirectory";
import type { TodayCentre } from "../../hooks/useDashboardData";
import { nf } from "../../lib/format";
import { cn } from "../../lib/cn";

type Tab = "collected" | "pending";

interface Props {
  open: boolean;
  onClose: () => void;
  /** today's centres that already poured milk */
  collected: TodayCentre[];
  /** yyyy-mm-dd of the figures */
  date: string;
  shift: string;
  loading?: boolean;
}

const TH =
  "sticky top-0 z-10 whitespace-nowrap border-b border-line bg-soft px-3 py-2.5 text-xs font-semibold text-mute";
const TD = "whitespace-nowrap border-b border-line/70 px-3 py-2.5 tnum";

const Mobile: React.FC<{ value?: string }> = ({ value }) =>
  value ? (
    <a href={`tel:${value}`} className="font-medium text-brand hover:underline">
      {value}
    </a>
  ) : (
    <span className="text-mute">—</span>
  );

export const VlccStatusModal: React.FC<Props> = ({
  open,
  onClose,
  collected,
  date,
  shift,
  loading,
}) => {
  const centres = useCentreOptions();
  const [tab, setTab] = useState<Tab>("collected");
  const [needle, setNeedle] = useState("");

  const ids = useMemo(() => centres.map((c) => c.id), [centres]);
  const dir = useVlccDirectory(ids, open);

  const labelOf = useMemo(
    () => new Map(centres.map((c) => [c.id, c.label])),
    [centres],
  );

  const doneRows = useMemo(
    () =>
      collected.map((c) => ({
        ...c,
        label: labelOf.get(c.id) ?? c.name ?? c.id,
        mobile: dir.mobile[c.id] ?? "",
        registered: dir.registered[c.id],
      })),
    [collected, labelOf, dir],
  );

  const pendingRows = useMemo(() => {
    const done = new Set(collected.map((c) => c.id));
    return centres
      .filter((c) => !done.has(c.id))
      .map((c) => ({
        id: c.id,
        label: c.label,
        mobile: dir.mobile[c.id] ?? "",
        registered: dir.registered[c.id],
      }));
  }, [centres, collected, dir]);

  const s = needle.trim().toLowerCase();
  const doneShown = s
    ? doneRows.filter((r) => `${r.label} ${r.mobile}`.toLowerCase().includes(s))
    : doneRows;
  const pendingShown = s
    ? pendingRows.filter((r) =>
        `${r.label} ${r.mobile}`.toLowerCase().includes(s),
      )
    : pendingRows;

  const close = () => {
    setNeedle("");
    setTab("collected");
    onClose();
  };

  const tabBtn = (active: boolean, tone: "ok" | "bad") =>
    cn(
      "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition sm:text-[13px]",
      active
        ? tone === "ok"
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-danger bg-danger text-white"
        : tone === "ok"
          ? "border-emerald-600/40 bg-panel text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400"
          : "border-danger/40 bg-panel text-danger hover:bg-danger/10",
    );

  const emptyText = loading
    ? "Loading collection…"
    : s
      ? "Nothing matches your search."
      : tab === "collected"
        ? "No centre has poured milk yet."
        : "Every centre has poured milk.";

  const rows = tab === "collected" ? doneShown : pendingShown;

  return createPortal(
    <Modal
      open={open}
      onClose={close}
      title="VLCC Collection Status"
      subtitle={`${date} · ${shift}`}
      width="max-w-5xl"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="Collection status"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "collected"}
              onClick={() => setTab("collected")}
              className={tabBtn(tab === "collected", "ok")}
            >
              <CircleCheck size={14} aria-hidden />
              Collected ({nf(doneRows.length)})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "pending"}
              onClick={() => setTab("pending")}
              className={tabBtn(tab === "pending", "bad")}
            >
              <CircleX size={14} aria-hidden />
              Not collected ({nf(pendingRows.length)})
            </button>
          </div>

          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Search centres</span>
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"
            />
            <input
              value={needle}
              onChange={(e) => setNeedle(e.target.value)}
              placeholder="Search..."
              className="h-10 w-full rounded-xl border border-line bg-panel pl-8 pr-3 text-sm outline-none transition placeholder:text-mute focus:border-brand/70"
            />
          </label>
        </div>

        {/* fixed height: the table scrolls inside this box, the popup itself never grows */}
        <div className="h-[52vh] min-h-[260px] max-h-[460px] overflow-auto overscroll-contain rounded-xl border border-line">
          <table
            className={cn(
              "w-full border-separate border-spacing-0 text-[13px]",
              tab === "collected" ? "min-w-[760px]" : "min-w-[520px]",
            )}
          >
            <thead>
              {tab === "collected" ? (
                <tr>
                  <th className={cn(TH, "w-12 text-left")}>#</th>
                  <th className={cn(TH, "text-left")}>VLCC Center</th>
                  <th className={cn(TH, "text-left")}>Mobile Number</th>
                  <th className={cn(TH, "text-right")}>Quantity (L)</th>
                  <th className={cn(TH, "text-right")}>Fat</th>
                  <th className={cn(TH, "text-right")}>SNF</th>
                  <th className={cn(TH, "text-right")}>Amount</th>
                  <th className={cn(TH, "text-right")}>Farmers</th>
                </tr>
              ) : (
                <tr>
                  <th className={cn(TH, "w-12 text-left")}>#</th>
                  <th className={cn(TH, "text-left")}>VLCC Center</th>
                  <th className={cn(TH, "text-left")}>Mobile Number</th>
                  <th className={cn(TH, "text-right")}>Registered Farmers</th>
                </tr>
              )}
            </thead>
            <tbody>
              {tab === "collected"
                ? doneShown.map((r, i) => (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-brand/[0.06]"
                    >
                      <td className={TD}>{i + 1}</td>
                      <td className={cn(TD, "whitespace-normal font-medium")}>
                        {r.label}
                      </td>
                      <td className={TD}>
                        <Mobile value={r.mobile} />
                      </td>
                      <td className={cn(TD, "text-right font-semibold")}>
                        {nf(r.litres, 2)}
                      </td>
                      <td className={cn(TD, "text-right")}>{nf(r.fat, 2)}</td>
                      <td className={cn(TD, "text-right")}>{nf(r.snf, 2)}</td>
                      <td className={cn(TD, "text-right")}>
                        ₹{nf(r.amount, 2)}
                      </td>
                      <td className={cn(TD, "text-right")}>
                        {nf(r.farmers)}
                        {r.registered !== undefined
                          ? ` (${nf(r.registered)})`
                          : ""}
                      </td>
                    </tr>
                  ))
                : pendingShown.map((r, i) => (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-brand/[0.06]"
                    >
                      <td className={TD}>{i + 1}</td>
                      <td className={cn(TD, "whitespace-normal font-medium")}>
                        {r.label}
                      </td>
                      <td className={TD}>
                        <Mobile value={r.mobile} />
                      </td>
                      <td className={cn(TD, "text-right")}>
                        {r.registered !== undefined
                          ? nf(r.registered)
                          : dir.loading
                            ? "…"
                            : "—"}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-mute">
              {emptyText}
            </p>
          )}
        </div>
      </div>
    </Modal>,
    document.body,
  );
};
