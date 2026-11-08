import { validateDateRange, validatePastLimit } from "../../../lib/dateRange";
import type * as React from "react";
import { useCallback, useRef, useState } from "react";
import { Search, Snowflake, Wallet } from "lucide-react";
import { Card, CardHeader } from "../../../components/operations/ui/Card";
import { Button } from "../../../components/operations/ui/Button";
import { Modal } from "../../../components/operations/ui/Modal";
import { Field } from "../../../components/operations/ui/Fields";
import { PastDateInput } from "../../../components/operations/ui/PastDateInput";
import { ReportPager } from "../../../components/operations/ui/ReportPager";
import { MilkLoader } from "../../../components/operations/MilkLoader";
import {
  CardTitle,
  ReportBar,
  Reveal,
  type BarKind,
} from "../../../components/operations/ReportKit";
import { CentreField } from "../../../components/operations/ReportFilters";
import { useCentreOptions } from "../../../hooks/useCentres";
import { useToast } from "../../../context/ToastContext";
import { EXTENDED_BILL_MARKER } from "../../../config/portal/reportAccess";
import { hasRoute, useNav } from "../../../components/layout/operations/nav";
import { DEFAULT_PAGE_SIZE, GLOBALLABELS } from "../../../lib/portal/global";
import { todayISO } from "../../../lib/portal/format";
import { cn } from "../../../lib/portal/cn";
import {
  billExportRows,
  farmerLabel,
  getPrintTableData,
  hasBillData,
  isMergedBill,
  missingRanges,
  replyKeys,
  idKey,
  parseFarmerBills,
  postBillFreeze,
  type BillExportRow,
  type BillShift,
  type FarmerBillData,
} from "../../../services/billing/farmerBill.api.ts";
import {
  exportCSV,
  exportExcel,
  exportPDF,
  type ExportCol,
} from "../../../lib/portal/export";
import {
  downloadFarmerBills,
  printFarmerBills,
  type BillPrintInfo,
} from "../../../lib/portal/farmerBillPrint";
import { getSession } from "../../../services/session";
import { fetchDpuFarmerMaster } from "../../../services/farmer/farmer.api";

const dmy = (s: string) => s.split("-").reverse().join("-");
const SHIFT_KEYS: Array<keyof BillShift> = ["wt", "fat", "snf", "rate", "amt"];
const HEADS = ["Wt", "Fat", "SNF", "Rate", "Amt"];

const shiftCols = (side: "m" | "e"): Array<ExportCol<BillExportRow>> =>
  SHIFT_KEYS.map((k, i) => ({
    header: HEADS[i],
    value: (r) =>
      side === "e" && k === "amt"
        ? (r.e?.amt ?? r.net ?? "")
        : (r[side]?.[k] ?? ""),
  }));

const BILL_COLS: Array<ExportCol<BillExportRow>> = [
  { header: "Farmer", value: (r) => r.farmer },
  { header: "Date", value: (r) => r.date },
  { header: "Milk", value: (r) => r.milk },
  ...shiftCols("m"),
  ...shiftCols("e"),
];
const BILL_GROUPS = [
  { label: "", span: 3 },
  { label: "Morning", span: 5 },
  { label: "Evening", span: 5 },
];

const HEAD = "border border-line bg-soft px-2 py-1.5 text-center font-bold";
const CELL = "border border-line px-2 py-1.5 text-center";

const BillCard: React.FC<{ bill: FarmerBillData; range: string }> = ({
  bill,
  range,
}) => (
  <article className="overflow-hidden rounded-2xl border border-line bg-panel">
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-4 py-3 text-sm">
      <p>
        <span className="font-bold">Farmer Name:</span>{" "}
        <span className="font-semibold">{farmerLabel(bill) || "—"}</span>
      </p>
      <p>
        <span className="font-bold">Date:</span>{" "}
        <span className="tnum">{bill.range || range}</span>
      </p>
    </div>

    <div className="overflow-x-auto p-3">
      <table className="w-full min-w-[680px] border-collapse text-[13px] tnum">
        <thead>
          <tr>
            <th rowSpan={2} className={HEAD}>
              Date
            </th>
            <th rowSpan={2} className={HEAD}>
              Milk
            </th>
            <th colSpan={5} className={HEAD}>
              Morning
            </th>
            <th colSpan={5} className={HEAD}>
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
          {bill.lines.map((d, i) => (
            <tr
              key={`${d.label}${d.milk}${i}`}
              className={d.total ? "bg-soft font-bold" : ""}
            >
              <td className={CELL}>{d.label}</td>
              <td className={CELL}>{d.milk}</td>
              {SHIFT_KEYS.map((k) => (
                <td key={`m${k}`} className={CELL}>
                  {d.m[k]}
                </td>
              ))}
              {SHIFT_KEYS.map((k) => (
                <td key={`e${k}`} className={CELL}>
                  {d.e[k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="overflow-x-auto px-3 pb-3">
      <table className="w-full min-w-[680px] border-collapse text-[13px] tnum">
        <tbody>
          {bill.summary.map((row, i) => (
            <tr key={i}>
              {row.map((p, j) => {
                const net = /net\s*payment/i.test(p.label);
                return (
                  <td
                    key={`${p.label}${j}`}
                    colSpan={j === row.length - 1 && row.length < 4 ? 5 - row.length : 1}
                    className={cn(
                      "w-1/4 border border-line px-3 py-1.5",
                      net && "bg-soft",
                    )}
                  >
                    <span className="flex justify-between gap-3">
                      <span
                        className={cn("text-mute", net && "font-bold text-ink")}
                      >
                        {p.label}:
                      </span>
                      <b className={net ? "text-base" : ""}>{p.value}</b>
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

/** farmer id -> name per VLC, asked from the farmer master once per VLC (only when the bill reply has no names) */
const nameCache = new Map<string, Map<string, string>>();

type Status = "idle" | "loading" | "ready" | "error";

const FarmerBill: React.FC = () => {
  const toast = useToast();
  const today = todayISO();
  const extended = hasRoute(useNav(), EXTENDED_BILL_MARKER);
  const options = useCentreOptions();

  const [vlc, setVlc] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [bills, setBills] = useState<FarmerBillData[]>([]);
  const [rawReply, setRawReply] = useState<unknown>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [applied, setApplied] = useState({ vlc: "", from: "", to: "" });
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const ticket = useRef(0);

  const vlcLabel = (id: string) =>
    options.find((o) => o.id === id)?.label ?? id;
  const missing = missingRanges(rawReply);
  // the server sent bills but none of them could be read (different from "no record")
  const unreadable = status === "ready" && bills.length === 0 && hasBillData(rawReply);
  const ready = status === "ready" && bills.length > 0;
  const total = bills.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const shown = bills.slice((safePage - 1) * pageSize, safePage * pageSize);
  const meta = {
    vlc: vlcLabel(applied.vlc),
    from: applied.from,
    to: applied.to,
  };

  const show = useCallback(async () => {
    if (!vlc) return;
    const rangeError = validateDateRange(from, to) ?? validatePastLimit(from);
    if (rangeError) {
      toast(rangeError, "warn");
      return;
    }
    const mine = ++ticket.current;
    setStatus("loading");
    setError("");
    setPage(1);
    setBills([]);
    setRawReply(null);
    setProgress(null);
    // farmer names of this VLC are asked at once (in parallel with the bill), so the bills show the names while they load
    let names: Map<string, string> | undefined = nameCache.get(vlc);
    const namesReady = names
      ? Promise.resolve()
      : fetchDpuFarmerMaster(vlc)
          .then((master) => {
            const m = new Map(master.map((f) => [idKey(f.farmerId), f.name]));
            if (m.size) nameCache.set(vlc, m);
            names = m;
          })
          .catch(() => undefined);
    const named = (list: FarmerBillData[]): FarmerBillData[] => {
      const known = names;
      return known ? list.map((b) => (b.name.trim() ? b : { ...b, name: known.get(idKey(b.id)) ?? "" })) : list;
    };
    try {
      const raw = await getPrintTableData(
        from,
        to,
        vlc,
        (p) => {
          if (mine !== ticket.current) return;
          // only the progress is shown while loading; the bills appear together once the whole period is in
          setProgress({ done: p.done, total: p.total });
        },
        () => mine !== ticket.current,
      );
      if (mine !== ticket.current) return;
      await namesReady;
      if (mine !== ticket.current) return;
      const list = named(parseFarmerBills(raw, extended));
      if (!list.length && hasBillData(raw)) console.warn("[farmer bill] the server replied with data that could not be read as a bill:", replyKeys(raw), raw);
      setBills(list);
      setRawReply(raw);
      setApplied({ vlc, from, to });
      setProgress(null);
      setStatus("ready");
    } catch (e) {
      if (mine !== ticket.current) return;
      setBills([]);
      setProgress(null);
      setStatus("error");
      setError(
        e instanceof Error ? e.message : "The bill could not be loaded.",
      );
    }
  }, [vlc, from, to, toast, extended]);

  const freeze = async () => {
    if (isMergedBill(rawReply)) {
      toast("This bill was loaded in shorter parts because the server was slow. Choose a shorter period (about 15 days) to freeze it.", "warn");
      setFreezeOpen(false);
      return;
    }
    setFreezing(true);
    try {
      const reply = await postBillFreeze({
        AutoRowNum: 0,
        VillageId: applied.vlc,
        EntryDate: todayISO(),
        StartDate: applied.from,
        EndDate: applied.to,
        flag: 1,
        json: JSON.stringify(rawReply),
      });
      const note = reply
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      toast(note && !/^[{[]/.test(note) ? note : "Bill freeze request sent");
      setFreezeOpen(false);
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "The bill could not be frozen",
        "warn",
      );
    } finally {
      setFreezing(false);
    }
  };

  const run = (kind: BarKind) => {
    if (!ready) return;
    const name = `farmer-bill-${applied.from}-to-${applied.to}`;
    if (kind === "print" || kind === "download") {
      const label = vlcLabel(applied.vlc);
      const info: BillPrintInfo = {
        dairy: getSession()?.mccName || "SmartX Dairy",
        villageId: applied.vlc,
        villageName: label.split(" | ")[0] || label,
        from: dmy(applied.from),
        to: dmy(applied.to),
      };
      if (kind === "print") {
        if (printFarmerBills(bills, info, name)) toast("Print dialog opened");
        else toast("Allow pop-ups to print the bill", "warn");
      } else {
        downloadFarmerBills(bills, info, name)
          .then(() => toast("Farmer bill PDF downloaded"))
          .catch(() => toast("The bill PDF could not be created", "warn"));
      }
      return;
    }
    // Excel / CSV: the farmer name is written on every line (filter / sort / pivot work per farmer); the printed bill shows it once
    const rows = billExportRows(bills, kind !== "pdf");
    if (kind === "pdf") {
      const sumOf = (label: string) =>
        bills.reduce(
          (a, b) =>
            a +
            Number(b.summary.flat().find((p) => p.label === label)?.value ?? 0),
          0,
        );
      exportPDF(name, BILL_COLS, rows, {
        subtitle: `Farmer Bill · ${dmy(applied.from)} To ${dmy(applied.to)}`,
        meta: [["VLC", meta.vlc]],
        groups: BILL_GROUPS,
        summary: [
          { label: "Farmers", value: String(total) },
          { label: "Total Liter", value: sumOf("Total Liter").toFixed(2) },
          {
            label: "Total Net Payment",
            value: sumOf("Net Payment").toFixed(2),
            tone: "ok",
          },
        ],
        landscape: true,
        note: "Center Incharge Signature : ______________________          Producer Signature : ______________________",
      });
      toast("Print dialog opened — choose Save as PDF to download");
    } else if (kind === "csv") {
      exportCSV(name, BILL_COLS, rows);
      toast("CSV file downloaded");
    } else {
      exportExcel(name, BILL_COLS, rows);
      toast("XLS file downloaded");
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <Reveal>
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-[2rem]">
          Farmer Bill
        </h1>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={Wallet}>Milk Payment</CardTitle>}
          />
          <div className="grid gap-x-4 gap-y-3 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_auto_auto]">
            <CentreField
              value={vlc}
              onChange={setVlc}
              label={GLOBALLABELS.vlcName}
            />
            <Field label={GLOBALLABELS.fromDate}>
              <PastDateInput
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label={GLOBALLABELS.toDate}>
              <PastDateInput
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <Button
                className="w-full"
                icon={<Search size={16} />}
                loading={status === "loading"}
                disabled={!vlc}
                onClick={show}
              >
                Show Record
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full !bg-brand !text-white enabled:hover:!bg-deep dark:!bg-brand/25 dark:!text-brand dark:enabled:hover:!bg-brand/40 disabled:!opacity-50"
                icon={<Snowflake size={16} />}
                disabled={!ready}
                onClick={() => setFreezeOpen(true)}
              >
                Freeze Bill
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        {/* bar + result in ONE card, like Payment Summary: the Print bar sits attached to what is below it */}
        <Card>
          <ReportBar
            count={total}
            pager={{
              page: safePage,
              size: pageSize,
              onSize: (n) => {
                setPageSize(n);
                setPage(1);
              },
            }}
            disabled={!ready}
            kinds={["print"]}
            onExport={run}
          />
          {status === "loading" && (
            <div className="p-6">
              <MilkLoader label={progress ? `Loading farmer bills… ${progress.done} of ${progress.total} parts` : "Loading farmer bills…"} />
              {progress && (
                <div className="mx-auto mt-4 h-1.5 max-w-sm overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                </div>
              )}
            </div>
          )}
          {status === "error" && (
            <p className="px-6 py-10 text-center text-sm text-danger">
              {error}
            </p>
          )}
          {status === "idle" && (
            <p className="px-6 py-10 text-center text-sm text-mute">
              Select a VLC and dates, then press Show Record.
            </p>
          )}
          {status === "ready" && total === 0 && !unreadable && (
            <p className="px-6 py-10 text-center text-sm text-mute">
              No record found for this VLC and these dates.
            </p>
          )}
          {unreadable && (
            <p className="px-6 py-10 text-center text-sm text-danger">
              The server sent data for this VLC, but the bill could not be read
              {replyKeys(rawReply).length ? ` (${replyKeys(rawReply).join(" | ").slice(0, 160)})` : ""}.
              Please try a shorter period or contact support.
            </p>
          )}
          {ready && missing.length > 0 && (
            <p className="border-b border-line bg-warn/10 px-5 py-2.5 text-sm text-warn">
              The server did not answer for {missing.join(", ")}. The bill below does not include those dates. Press Show Record again to load them.
            </p>
          )}
          {status === "ready" && shown.length > 0 && (
            <div className="space-y-4 p-4 sm:p-5">
              {shown.map((b, i) => (
                <BillCard
                  key={`${b.name}-${safePage}-${i}`}
                  bill={b}
                  range={`${dmy(applied.from)} To ${dmy(applied.to)}`}
                />
              ))}
            </div>
          )}
          {ready && (
            <ReportPager
              total={total}
              page={safePage}
              size={pageSize}
              onPage={setPage}
            />
          )}
        </Card>
      </Reveal>

      <Modal
        open={freezeOpen}
        onClose={() => (freezing ? undefined : setFreezeOpen(false))}
        title="Freeze Bill"
        subtitle={`${meta.vlc} · ${dmy(applied.from)} To ${dmy(applied.to)}`}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={freezing}
              onClick={() => setFreezeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              icon={<Snowflake size={15} />}
              loading={freezing}
              onClick={freeze}
            >
              Freeze Bill
            </Button>
          </>
        }
      >
        <p className="text-sm text-mute">
          The bill of {total} farmer{total === 1 ? "" : "s"} for this VLC and
          these dates will be frozen on the portal.
        </p>
      </Modal>
    </div>
  );
};

export default FarmerBill;
