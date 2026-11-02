import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ReceiptText, Search } from "lucide-react";
import { Card, CardHeader } from "../../../components/operations/ui/Card";
import { Button } from "../../../components/operations/ui/Button";
import { Field, Input, Select } from "../../../components/operations/ui/Fields";
import { MilkLoader } from "../../../components/operations/MilkLoader";
import {
  CardTitle,
  ReportBar,
  ReportPage,
  Reveal,
  type ExportKind,
} from "../../../components/operations/ReportKit";
import { ErrorBlock } from "../../../components/operations/Widget";
import { useCentreOptions } from "../../../hooks/useCentres";
import { todayISO } from "../../../lib/portal/format";
import {
  downloadBillsExcel,
  printBills,
  sanitizeBillHtml,
  splitBills,
  textOf,
} from "../../../lib/portal/safeHtml";
import { getVlcMilkBill } from "../../../services/billing/vlcMilkBill.api";
import { ApiError } from "../../../services/http/errors";

const PAGE_SIZES = [10, 25, 50, 100, 250];

// The bill is a printed-paper style document, so it stays black on white in light and dark mode.
const PAPER =
  "overflow-x-auto rounded-xl border border-line bg-white p-4 text-sm text-slate-900 shadow-sm sm:p-6 " +
  "[&_table]:w-full [&_table]:border-collapse [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-bold " +
  "[&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap " +
  "[&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-bold [&_h4]:font-bold [&_p]:my-1 [&_img]:max-w-full";

const VlcMilkBill: React.FC = () => {
  const options = useCentreOptions();
  const today = todayISO();

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(
    null,
  );

  const [bills, setBills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);

  const range = !!from && !!to && from <= to;
  const ready = range && options.length > 0;

  const submit = async () => {
    if (loading || !ready) return;
    const f = { from, to };
    setApplied(f);
    setLoading(true);
    setError(null);
    setNeedle("");
    setPage(1);
    try {
      const markup = await getVlcMilkBill({
        fromdate: f.from,
        todate: f.to,
        stationIds: options.map((o) => o.id),
      });
      setBills(splitBills(sanitizeBillHtml(markup)));
    } catch (e) {
      setBills([]);
      setError(
        e instanceof ApiError ? e.message : "The milk bill could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  const visible = useMemo(() => {
    const s = needle.trim().toLowerCase();
    return s ? bills.filter((b) => textOf(b).toLowerCase().includes(s)) : bills;
  }, [bills, needle]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const start = (page - 1) * pageSize;
  const shown = visible.slice(start, start + pageSize);

  const run = (kind: ExportKind) => {
    if (!applied || visible.length === 0) return;
    const name = `vlc-milk-bill-${applied.from}-${applied.to}`;
    if (kind === "xls") return downloadBillsExcel(name, visible);
    printBills("VLC Milk Bill", visible);
  };

  const hasData = !!applied && !loading && !error && visible.length > 0;

  return (
    <ReportPage
      title="VLC Milk Bill"
      subtitle="Choose the dates, then press Show Record."
    >
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={ReceiptText}>Milk Bill</CardTitle>}
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
            <Field label="From Date">
              <Input
                type="date"
                value={from}
                max={today}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field
              label="To Date"
              hint={
                from && to && from > to
                  ? "To Date must not be before From Date."
                  : undefined
              }
            >
              <Input
                type="date"
                value={to}
                max={today}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
            <div className="flex items-end sm:col-span-2">
              <Button
                className="w-full"
                icon={<Search size={16} />}
                loading={loading}
                disabled={!ready}
                onClick={() => void submit()}
              >
                Show Record
              </Button>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* Always on screen, empty until Show Record is pressed */}
      <Reveal delay={0.1}>
        <Card>
          <ReportBar
            count={hasData ? visible.length : 0}
            hideCount={loading}
            disabled={!hasData}
            kinds={["pdf", "xls"]}
            labels={{ pdf: "Print Bill", xls: "Excel Export" }}
            onExport={run}
            left={
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-48 max-w-full">
                  <Input
                    placeholder="Search any column"
                    value={needle}
                    onChange={(e) => {
                      setNeedle(e.target.value);
                      setPage(1);
                    }}
                    disabled={!applied}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <span className="font-bold">Result per page:</span>
                  <div className="w-24">
                    <Select
                      value={String(pageSize)}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      {PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </div>
                </label>
              </div>
            }
          />

          {!applied ? (
            <p className="px-6 py-12 text-center text-sm text-mute">
              Pick the dates and press <b>Show Record</b> to see the bill.
            </p>
          ) : loading ? (
            <MilkLoader label="Loading milk bill…" />
          ) : error ? (
            <ErrorBlock message={error} onRetry={() => void submit()} />
          ) : visible.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-mute">
              {bills.length === 0
                ? "No record for these dates."
                : "Nothing matches your search."}
            </p>
          ) : (
            <div className="space-y-4 p-4 sm:p-5">
              {shown.map((html, i) => (
                <div
                  key={start + i}
                  className={PAPER}
                  // markup was cleaned by sanitizeBillHtml (no scripts, styles, handlers or classes)
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ))}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-line pt-4 text-sm text-mute sm:flex-row">
                <p className="tnum">
                  Showing{" "}
                  <b className="text-ink">
                    {start + 1}–{Math.min(start + pageSize, visible.length)}
                  </b>{" "}
                  of {visible.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<ChevronLeft size={15} />}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className="tnum px-1">
                    {page} / {pages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<ChevronRight size={15} />}
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default VlcMilkBill;
