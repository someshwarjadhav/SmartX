import type * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, FileSpreadsheet, ListChecks, Building2 } from "lucide-react";
import { Card, CardHeader } from "../../../components/operations/ui/Card";
import { Button } from "../../../components/operations/ui/Button";
import { Badge } from "../../../components/operations/ui/Badge";
import { Pager } from "../../../components/operations/ui/Pager";
import { ResultPerPage } from "../../../components/operations/ui/ResultPerPage";
import { DEFAULT_PAGE_SIZE } from "../../../lib/portal/global";
import { Segmented } from "../../../components/operations/ui/Fields";
import { StatCard } from "../../../components/operations/ui/StatCard";
import { EmptyState } from "../../../components/operations/EmptyState";
import { ErrorBlock } from "../../../components/operations/Widget";
import { MilkLoader } from "../../../components/operations/MilkLoader";
import { useSmoothLoading } from "../../../hooks/useSmoothLoading";
import { CardTitle, ReportPage, Reveal } from "../../../components/operations/ReportKit";
import { useToast } from "../../../context/ToastContext";
import { GLOBALS } from "../../../lib/portal/global";
import { getSession } from "../../../services/session";
import { ApiError } from "../../../services/http/errors";
import { MILK_TYPES, getRateStatus, type RateStatusRow } from "../../../services/master/rate.api.ts";
import { exportRateStatus } from "../../../assets/excel/rate.excel.ts";
import { clipTitle } from '../../../lib/clipTitle';

const GOOD = /^(1|true|active|done|success|sync|synced|downloaded)/i;
const WAIT = /^(0|pending|waiting|queued)/i;

const COLUMNS: Array<[keyof RateStatusRow, string]> = [
  ["villageId", "Village Id"],
  ["villageName", "Village Name"],
  ["effectiveDate", "Effective Date"],
  ["entryDate", "Entry Date"],
  ["currentRate", "Current Rate"],
  ["downloadDate", "Download Date"],
  ["downloadTime", "Download Time"],
  ["rateId", "RateId"],
  ["status", "Status"],
];

const RateStatus: React.FC = () => {
  const toast = useToast();
  const [type, setType] = useState<string>("C");
  const [rows, setRows] = useState<RateStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const showLoader = useSmoothLoading(loading);

  const sess = getSession();
  const mccid = sess?.mccLoginId || GLOBALS.mccLoginId || sess?.mccId || GLOBALS.mccid || "";
  const plantid = GLOBALS.plantid || "";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setPage(1);
    getRateStatus(mccid, plantid, type)
      .then((r) => alive && setRows(r))
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        setError(e instanceof ApiError ? e.message : "The rate status could not be loaded.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [mccid, plantid, type, tick]);

  const done = useMemo(() => rows.filter((r) => GOOD.test(r.status)).length, [rows]);
  const pending = useMemo(() => rows.filter((r) => WAIT.test(r.status)).length, [rows]);
  const total = rows.length;
  const lastPage = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, lastPage);
  const from = total ? (current - 1) * size + 1 : 0;
  const to = Math.min(total, current * size);
  const visible = useMemo(() => rows.slice((current - 1) * size, current * size), [rows, current, size]);

  const exportAll = useCallback(() => {
    if (!rows.length) return toast("There is nothing to export", "warn");
    const name = MILK_TYPES.find((m) => m.code === type)?.label ?? type;
    void exportRateStatus(rows, `RateStatus_${name}`);
  }, [rows, type, toast]);

  return (
    <ReportPage title="Rate Status" subtitle="Which rate chart each centre has downloaded, by milk type.">
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            title={<CardTitle icon={ListChecks}>Rate Status</CardTitle>}
            action={
              <Button icon={<FileSpreadsheet />} onClick={exportAll}>
                Excel Export
              </Button>
            }
          />
          <div className="space-y-4 px-5 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatCard compact tone="text-brand" label="Centres" icon={<Building2 />} value={total} loading={loading} hint="With a rate for this milk type" />
              <StatCard compact tone="text-ok" label="Downloaded" icon={<CheckCircle2 />} value={done} loading={loading} hint="Rate reached the machine" />
              <StatCard compact tone="text-warn" label="Pending" icon={<Clock />} value={pending} loading={loading} hint="Waiting to be downloaded" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented
                value={type}
                onChange={(v) => setType(v)}
                options={MILK_TYPES.map((m) => ({ value: m.code, label: m.label }))}
              />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <p className="tnum text-sm text-mute"><span className="font-bold text-ink">Record Count:</span> {from} - {to} of {total}</p>
                {total > 0 && <ResultPerPage size={size} onSize={(n) => { setSize(n); setPage(1); }} />}
              </div>
            </div>

            {error && <ErrorBlock compact message={error} onRetry={() => setTick((t) => t + 1)} busy={loading} />}

            {showLoader ? (
              <MilkLoader label="Loading rate status…" />
            ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="clip-cells w-full text-[13px]" onMouseOver={clipTitle}>
                <thead className="bg-soft/70 text-left text-xs text-mute">
                  <tr>
                    {COLUMNS.map(([k, label]) => (
                      <th key={k} className="whitespace-nowrap px-3 py-3 font-semibold">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={`${r.villageId}-${r.rateId}-${i}`} className="border-t border-line hover:bg-soft/60">
                      {COLUMNS.map(([k]) => (
                        <td key={k} className="whitespace-nowrap px-3 py-2 tnum">
                          {k === "status" ? (
                            r.status ? (
                              <Badge tone={GOOD.test(r.status) ? "ok" : WAIT.test(r.status) ? "warn" : "neutral"} dot>
                                {r.status}
                              </Badge>
                            ) : (
                              ""
                            )
                          ) : (
                            r[k]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !error && !rows.length && (
                <EmptyState title="No rate status" hint="No centre has a rate for this milk type yet." />
              )}
            </div>
            )}

            {total > 0 && <Pager total={total} page={current} size={size} onPage={setPage} />}
          </div>
        </Card>
      </Reveal>
    </ReportPage>
  );
};

export default RateStatus;
