import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ReceiptText, Search } from "lucide-react";
import { Card, CardHeader } from "../../../components/operations/ui/Card";
import { Button } from "../../../components/operations/ui/Button";
import { Field, Input, Select } from "../../../components/operations/ui/Fields";
import { PastDateInput } from "../../../components/operations/ui/PastDateInput";
import { MilkLoader } from "../../../components/operations/MilkLoader";
import {
  CardTitle,
  ReportBar,
  ReportPage,
  Reveal,
  type BarKind,
} from "../../../components/operations/ReportKit";
import { ErrorBlock } from "../../../components/operations/Widget";
import { useCentreOptions } from "../../../hooks/useCentres";
import { todayISO } from "../../../lib/portal/format";
import {
  VlcBillCard,
  vlcBillText,
} from "../../../components/operations/billing/VlcBillCard";
import {
  downloadVlcBills,
  printVlcBills,
  type BillPrintInfo,
} from "../../../lib/portal/vlcBillPrint";
import { exportVlcBillExcel } from "../../../assets/excel/vlcBillExcel";
import { getSession } from "../../../services/session";
import { getProfileFromSession } from "../../../services/profile/profile.api";
import { getVlcMilkBill, type VlcBill } from "../../../services/billing/vlcMilkBill.api";
import { ApiError } from "../../../services/http/errors";
import { validateDateRange } from "../../../lib/dateRange";
import { useToast } from "../../../context/ToastContext";


const dmy = (s: string) => s.split("-").reverse().join("-");

const PAGE_SIZES = [100, 200, 300];

const VlcMilkBill: React.FC = () => {
  const options = useCentreOptions();
  const today = todayISO();

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(
    null,
  );

  const [bills, setBills] = useState<VlcBill[]>([]);
  const [failed, setFailed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needle, setNeedle] = useState("");
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);

  const toast = useToast();
  const range = !!from && !!to && from <= to;
  const ready = range && options.length > 0;

  const submit = async () => {
    if (loading || options.length === 0) return;
    const rangeError = validateDateRange(from, to);
    if (rangeError) return toast(rangeError, "warn");
    const f = { from, to };
    setApplied(f);
    setLoading(true);
    setError(null);
    setNeedle("");
    setPage(1);
    setFailed(0);
    try {
      const res = await getVlcMilkBill({
        fromdate: f.from,
        todate: f.to,
        stationIds: options.map((o) => o.id),
      });
      // one bill per centre, built from the cowMilk / buffaloMilk / mixMilk lists of the API
      setBills(res.bills);
      setFailed(res.failed);
    } catch (e) {
      setBills([]);
      setError(
        e instanceof ApiError ? e.message : "The milk bill could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  // header of the bill: dairy name + address / phone / GST of the login (same as the Farmer Bill)
  const dairyInfo = useMemo(() => {
    const p = getProfileFromSession();
    return {
      dairy: getSession()?.mccName || "SmartX Dairy",
      address: p.Address || undefined,
      phone: p.mobile || undefined,
      gst: p.GST || undefined,
    };
  }, []);

  // on-screen look = Farmer Bill card (VlcBillCard); Excel and Print have their own formats (vlcBillExcel / vlcBillPrint)
  const entries = useMemo(
    () => bills.map((bill) => ({ bill, text: vlcBillText(bill).toLowerCase() })),
    [bills],
  );
  const visibleBills = useMemo(() => {
    const s = needle.trim().toLowerCase();
    return s ? entries.filter((e) => e.text.includes(s)) : entries;
  }, [entries, needle]);

  const visible = visibleBills;
  const total = bills.length;

  const pages = Math.max(1, Math.ceil(visibleBills.length / pageSize));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const start = (page - 1) * pageSize;
  const shown = visibleBills.slice(start, start + pageSize);

  const run = (kind: BarKind) => {
    if (!applied || visible.length === 0) return;
    const name = `vlc-milk-bill-${applied.from}-to-${applied.to}`;
    const list = visibleBills.map((e) => e.bill);
    if (kind === "xls") {
      void exportVlcBillExcel(name, list).then(
        () => toast("XLS file downloaded"),
        () => toast("The Excel file could not be created", "warn"),
      );
      return;
    }
    const info: BillPrintInfo = {
      ...dairyInfo,
      villageId: "",
      villageName: "",
      from: dmy(applied.from),
      to: dmy(applied.to),
    };
    if (kind === "download") {
      downloadVlcBills(list, info, name)
        .then(() => toast("VLC milk bill PDF downloaded"))
        .catch(() => toast("The bill PDF could not be created", "warn"));
      return;
    }
    if (printVlcBills(list, info, name)) toast("Print dialog opened");
    else toast("Allow pop-ups to print the bill", "warn");
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
              <PastDateInput
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
              <PastDateInput
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
            kinds={["print", "download", "xls"]}
            labels={{
              print: "Print Bill",
              download: "Download PDF",
              xls: "Excel Export",
            }}
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
              {total === 0
                ? "No record for these dates."
                : "Nothing matches your search."}
            </p>
          ) : (
            <div className="space-y-4 p-4 sm:p-5">
              {failed > 0 && (
                <p className="text-sm text-warn">
                  {failed} centre(s) could not be loaded, the rest are shown.
                </p>
              )}
              {shown.map(({ bill }, i) => (
                <VlcBillCard key={`${bill.stationId}-${start + i}`} bill={bill} />
              ))}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-line pt-4 text-sm text-mute sm:flex-row">
                <p className="tnum">
                  Showing{" "}
                  <b className="text-ink">
                    {start + 1}–{Math.min(start + pageSize, visibleBills.length)}
                  </b>{" "}
                  of {visibleBills.length}
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