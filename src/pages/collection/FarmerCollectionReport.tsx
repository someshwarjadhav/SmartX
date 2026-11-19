import type * as React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Droplets,
  FlaskConical,
  Milk,
  Search,
  SearchX,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import {
  useMilkCenterOptions,
  useReportScope,
  centreIdsFor,
} from '../../hooks/useMilkReportData';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { reportActions } from '../../components/ui/reportActions';
import type { ColType, ExportTable } from '../../assets/excel/exporters';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { Panel } from '../../components/ui/Panel';
import { StatCard } from '../../components/ui/StatCard';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Toast } from '../../components/ui/Toast';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Fields';
import { Segmented } from '../../components/ui/Segmented';
import { DateRangeFields } from '../../components/ui/DateRangeFields';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { fmtDate, nf, toISO } from '../../lib/format';
import { validateDateRange, validatePastLimit } from '../../lib/dateRange';
import { MSG } from '../../lib/messages';
import { getSession } from '../../services/session';
import { isCancelled } from '../../services/http/errors';
import {
  fetchFarmerCollectionReport,
  type CollectionReportRow,
  type ReportMilk,
} from '../../services/report/farmerCollectionReport.api';

/* ---------- Filter card (same fields as the portal: Plant/MCC, VLC, Milk Type, From / To, Submit) ---------- */

interface ReportFilters {
  plant: string;
  centre: string;
  milk: ReportMilk;
  from: string;
  to: string;
}

const MILK_OPTIONS: { value: ReportMilk; label: string }[] = [
  { value: 'cow', label: 'Cow' },
  { value: 'buffalo', label: 'Buffalo' },
  { value: 'mix', label: 'Mix' },
  { value: 'both', label: 'Both' },
];

const SEGMENT = 'w-full [&>button]:h-9 [&>button]:flex-1';

const defaults = (): ReportFilters => {
  const today = toISO(new Date());
  return { plant: '', centre: '', milk: 'cow', from: today, to: today };
};

/** 2026-11-19 -> 19/11/2026 */
const dmy = (iso: string): string => {
  const [y = '', m = '', d = ''] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

/* ---------- Table columns (exactly the portal's Farmer Collection Report columns) ---------- */

const n2 = (v: number): React.ReactNode => <span className="tnum">{nf(v, 2)}</span>;

const COLUMNS: Column<CollectionReportRow>[] = [
  { key: 'dcsCode', header: 'DCS Code', cell: (r) => <span className="tnum">{r.dcsCode}</span> },
  {
    key: 'dcsName',
    header: 'DCS Name',
    cell: (r) => (
      <span className="block truncate whitespace-nowrap" title={r.dcsName}>
        {r.dcsName}
      </span>
    ),
    width: 190,
  },
  { key: 'date', header: 'Date', cell: (r) => <span className="tnum whitespace-nowrap">{dmy(r.date)}</span> },
  { key: 'memberCode', header: 'Member Code', cell: (r) => <span className="tnum">{r.memberCode}</span> },
  {
    key: 'memberName',
    header: 'Member Name',
    cell: (r) => (
      <span className="block truncate whitespace-nowrap font-semibold" title={r.memberName}>
        {r.memberName}
      </span>
    ),
    mobile: 'title',
    width: 190,
  },
  { key: 'milkType', header: 'Milk Type', cell: (r) => <span>{r.milkType}</span> },
  { key: 'morningQty', header: 'Morning Qty', align: 'right', cell: (r) => n2(r.morningQty) },
  { key: 'morningLr', header: 'Morning LR', align: 'right', cell: (r) => n2(r.morningLr) },
  { key: 'morningFat', header: 'Morning Fat', align: 'right', cell: (r) => n2(r.morningFat) },
  { key: 'morningSnf', header: 'Morning SNF', align: 'right', cell: (r) => n2(r.morningSnf) },
  { key: 'morningRate', header: 'Morning Rate', align: 'right', cell: (r) => n2(r.morningRate) },
  { key: 'eveningQty', header: 'Evening Qty', align: 'right', cell: (r) => n2(r.eveningQty) },
  { key: 'eveningLr', header: 'Evening LR', align: 'right', cell: (r) => n2(r.eveningLr) },
  { key: 'eveningFat', header: 'Evening Fat', align: 'right', cell: (r) => n2(r.eveningFat) },
  { key: 'eveningSnf', header: 'Evening SNF', align: 'right', cell: (r) => n2(r.eveningSnf) },
  { key: 'eveningRate', header: 'Evening Rate', align: 'right', cell: (r) => n2(r.eveningRate) },
];

/** PDF / CSV / Excel: the same columns as the table (no Total row). */
type ExportCol = {
  header: string;
  type?: ColType;
  value: (r: CollectionReportRow) => string | number;
};
const EXPORT_COLS: ExportCol[] = [
  { header: 'DCS Code', value: (r) => r.dcsCode },
  { header: 'DCS Name', value: (r) => r.dcsName },
  { header: 'Date', value: (r) => dmy(r.date) },
  { header: 'Member Code', value: (r) => r.memberCode },
  { header: 'Member Name', value: (r) => r.memberName },
  { header: 'Milk Type', value: (r) => r.milkType },
  { header: 'Morning Qty', type: 'dec2', value: (r) => r.morningQty },
  { header: 'Morning LR', type: 'dec2', value: (r) => r.morningLr },
  { header: 'Morning Fat', type: 'dec2', value: (r) => r.morningFat },
  { header: 'Morning SNF', type: 'dec2', value: (r) => r.morningSnf },
  { header: 'Morning Rate', type: 'dec2', value: (r) => r.morningRate },
  { header: 'Evening Qty', type: 'dec2', value: (r) => r.eveningQty },
  { header: 'Evening LR', type: 'dec2', value: (r) => r.eveningLr },
  { header: 'Evening Fat', type: 'dec2', value: (r) => r.eveningFat },
  { header: 'Evening SNF', type: 'dec2', value: (r) => r.eveningSnf },
  { header: 'Evening Rate', type: 'dec2', value: (r) => r.eveningRate },
];

const FarmerCollectionReport: React.FC = () => {
  const resultsRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const toast = useToast();
  const centres = useMilkCenterOptions();

  const [draft, setDraft] = useState<ReportFilters>(defaults);
  const [applied, setApplied] = useState<ReportFilters>(defaults);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const [rows, setRows] = useState<CollectionReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // dropdowns: real plants / VLCs plus an "All" row (same as the Farmer Collection page)
  const scope = useReportScope(centres, draft.plant, draft.centre, true);

  const plantName =
    applied.plant === 'all'
      ? 'All'
      : (centres.find((c) => c.mccId === applied.plant)?.plantName ?? '');
  const centreName =
    applied.centre === 'all'
      ? 'All'
      : (centres.find((c) => c.id === applied.centre)?.label ?? '');

  const load = useCallback(
    async (f: ReportFilters) => {
      const id = ++requestId.current;
      const stationIds = centreIdsFor(centres, f.plant, f.centre);
      const session = getSession();
      const mccId =
        f.plant && f.plant !== 'all' && /^\d+$/.test(f.plant)
          ? f.plant
          : (session?.mccId ?? '');
      setLoading(true);
      setLoadError(null);
      setRows([]);
      setProgress({ done: 0, total: 0 });
      try {
        const data = await fetchFarmerCollectionReport({
          milk: f.milk,
          from: f.from,
          to: f.to,
          stationIds,
          allCentres: f.centre === 'all',
          mccId,
          onProgress: (done, total) => {
            if (id === requestId.current) setProgress({ done, total });
          },
        });
        if (id !== requestId.current) return;
        setRows(data);
      } catch (e) {
        if (id !== requestId.current || isCancelled(e)) return;
        setLoadError(e instanceof Error ? e.message : 'The report could not be loaded.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [centres],
  );

  const submit = () => {
    const rangeError =
      validateDateRange(draft.from, draft.to) ?? validatePastLimit(draft.from);
    if (rangeError) {
      setError(rangeError);
      toast.show(rangeError, 'warn');
      return;
    }
    if (!scope.centre) {
      setError(MSG.noCentreInPlant);
      toast.show(MSG.noCentreInPlant, 'warn');
      return;
    }
    setError(undefined);
    const next: ReportFilters = { ...draft, plant: scope.plant, centre: scope.centre };
    setApplied(next);
    setSubmitted(true);
    pager.reset();
    void load(next); // every Submit asks the server again
    window.setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      60,
    );
  };

  const pager = usePagination(rows);

  const totals = useMemo(() => {
    let litres = 0;
    let fat = 0;
    let snf = 0;
    const farmers = new Set<string>();
    for (const r of rows) {
      litres += r.morningQty + r.eveningQty;
      fat += r.morningQty * r.morningFat + r.eveningQty * r.eveningFat;
      snf += r.morningQty * r.morningSnf + r.eveningQty * r.eveningSnf;
      farmers.add(`${r.dcsCode}:${r.memberCode}`);
    }
    return {
      litres,
      fat: litres ? fat / litres : 0,
      snf: litres ? snf / litres : 0,
      farmers: farmers.size,
    };
  }, [rows]);

  /** PDF / CSV / Excel: header + data rows only (no Total row). */
  const buildTable = (): ExportTable => ({
    filename: `farmer-collection-report-${applied.from}-${applied.to}`,
    title: 'Farmer collection report',
    subtitle: `${plantName}  |  ${centreName}  |  ${
      applied.milk === 'both' ? 'Cow, Buffalo & Mix' : (MILK_OPTIONS.find((m) => m.value === applied.milk)?.label ?? '')
    }  |  ${fmtDate(applied.from)} to ${fmtDate(applied.to)}`,
    columns: EXPORT_COLS.map((c) => ({
      header: c.header,
      ...(c.type ? { type: c.type } : {}),
    })),
    rows: rows.map((r) => EXPORT_COLS.map((c) => c.value(r))),
  });

  // Excel Export / PDF Export / CSV Export, like the portal (no Print, no Old / New Excel)
  const actions: ExportAction[] = reportActions({
    build: buildTable,
    count: rows.length,
    unit: 'entries',
    toast: toast.show,
    without: ['print'],
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Farmer Collection Report"
        subtitle="Morning and evening quantity, LR, fat, SNF and rate for every member, by DCS and date."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard index={0} tone="brand" label="Total Liter" note="Litres collected" icon={Milk} value={totals.litres} format={(n) => nf(n, 1)} />
        <StatCard index={1} tone="ok" label="Fat" note="Weighted average %" icon={Droplets} value={totals.fat} format={(n) => nf(n, 2)} />
        <StatCard index={2} tone="warn" label="Snf" note="Weighted average %" icon={FlaskConical} value={totals.snf} format={(n) => nf(n, 2)} />
        <StatCard index={3} tone="danger" label="Total Farmer" note="Pouring in this range" icon={Users} value={totals.farmers} format={(n) => nf(Math.round(n))} />
      </div>

      <section
        aria-label="User Info"
        className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card"
      >
        <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-card">
            <SlidersHorizontal size={17} aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold leading-tight">User Info</h2>
            <p className="text-xs text-mute">Pick the plant, VLC, milk and dates, then press Submit.</p>
          </div>
        </header>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-12"
        >
          <SelectField
            wrapperClassName="xl:col-span-4"
            label="Plant/MCC Name"
            value={scope.plant}
            onChange={(plant) => setDraft((d) => ({ ...d, plant, centre: '' }))}
            options={scope.plantOptions}
          />
          <SelectField
            wrapperClassName="xl:col-span-4"
            label="VLC Name"
            value={scope.centre}
            onChange={(centre) => setDraft((d) => ({ ...d, centre }))}
            options={scope.centreOptions}
          />
          <Field label="Milk Type" className="xl:col-span-4">
            <Segmented<ReportMilk>
              label="Milk Type"
              value={draft.milk}
              onChange={(milk) => setDraft((d) => ({ ...d, milk }))}
              options={MILK_OPTIONS}
              className={SEGMENT}
            />
          </Field>
          <div className="sm:col-span-2 xl:col-span-6">
            <DateRangeFields
              from={draft.from}
              to={draft.to}
              onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              error={error}
            />
          </div>
          <div className="flex items-end sm:col-span-2 xl:col-span-6">
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              icon={<Search size={16} aria-hidden />}
              className="group h-11 w-full bg-gradient-to-r from-brand to-glow"
            >
              Submit
            </Button>
          </div>
        </form>
      </section>

      {loadError && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {loadError}{' '}
          <button className="ml-2 underline" onClick={() => void load(applied)}>
            Retry
          </button>
        </div>
      )}

      <div ref={resultsRef} className="scroll-mt-20">
        <Panel bodyClassName="!p-0">
          {!submitted ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="Set your filters first"
              text="Choose the options above and press Submit to load the data."
            />
          ) : (
            <>
              <TableToolbar
                from={pager.from}
                to={pager.to}
                total={pager.total}
                pageSize={pager.pageSize}
                onPageSize={pager.setPageSize}
                sizeLabel="Result per page"
                actions={<ExportBar actions={actions} disabled={loading || rows.length === 0} />}
              />

              {loading ? (
                <ReportLoader
                  label="Loading farmer collection report…"
                  done={progress.done}
                  total={progress.total}
                />
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No collection found"
                  text="Try another date range, VLC or milk type."
                />
              ) : (
                <DataTable
                  columns={COLUMNS}
                  rows={pager.visible}
                  rowKey={(r) => r.id}
                  ariaLabel="Farmer collection report"
                />
              )}

              {!loading && rows.length > 0 && (
                <Pagination
                  page={pager.page}
                  pageSize={pager.pageSize}
                  total={pager.total}
                  onPage={pager.goTo}
                  onPageSize={pager.setPageSize}
                  showSize={false}
                />
              )}
            </>
          )}
        </Panel>
      </div>

      <Toast message={toast.message} onClose={toast.close} />
    </div>
  );
};

export default FarmerCollectionReport;
