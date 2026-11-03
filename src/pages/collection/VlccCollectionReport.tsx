import type * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Droplets, FlaskConical, Milk, Moon, Search, SearchX, SlidersHorizontal, Store, Sun } from 'lucide-react';
import { useMilkVlccEntries, useMilkCenterOptions } from '../../hooks/useMilkReportData';
import { KIND_OPTIONS, SHIFT_OPTIONS, type Shift } from '../../data/masters';
import type { MilkKind } from '../../types';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { reportActions } from '../../components/ui/reportActions';
import { PartialNotice } from '../../components/ui/PartialNotice';
import type { ExportTable } from '../../lib/exporters';
import { Field, SelectField, TextField } from '../../components/ui/Fields';
import { PageHeader } from '../../components/ui/PageHeader';
import { useReportTable } from '../../hooks/useSessionData';
import { Pagination } from '../../components/ui/Pagination';
import { Panel } from '../../components/ui/Panel';
import { Segmented } from '../../components/ui/Segmented';
import { StatCard } from '../../components/ui/StatCard';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Toast } from '../../components/ui/Toast';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/cn';
import { fmtDate, nf, toISO } from '../../lib/format';

/* ---------- Types ---------- */

type KindFilter = MilkKind | 'both';
type ShiftFilter = Shift | 'both';

const KIND_FILTER_OPTIONS: { value: KindFilter; label: string }[] = [...KIND_OPTIONS, { value: 'both', label: 'Both' }];
const SHIFT_FILTER_OPTIONS: { value: ShiftFilter; label: string }[] = [...SHIFT_OPTIONS, { value: 'both', label: 'Both' }];

/** Filter keys = API request params (VLC Name -> vlcId, Milk Type -> milkType, Shift -> shift, From/To Date). */
interface Filters {
  vlcId: string;
  milkType: KindFilter;
  shift: ShiftFilter;
  fromDate: string;
  toDate: string;
}

/** One table row = one VLC, one date, one shift. */
interface VlccRow {
  id: string;
  stationId: string;
  village: string;
  date: string;
  shift: Shift;
  totalLiter: number;
  avgFat: number;
  avgSnf: number;
  avgRate: number;
  totalAmount: number;
}

/* ---------- Data source (dummy) ---------- */


/* ---------- Filter card ---------- */

interface FilterProps {
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onSubmit: () => void;
  error?: string;
  loading?: boolean;
}

const SEGMENT = 'w-full [&>button]:h-9 [&>button]:flex-1';


const VlccFilters: React.FC<FilterProps & { options: { value: string; label: string }[] }> = ({ value, options, onChange, onSubmit, error, loading }) => (
  <section aria-label="User Info" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
    <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-card">
        <SlidersHorizontal size={17} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold leading-tight">User Info</h2>
        <p className="text-xs text-mute">Pick the VLC, milk, shift and dates, then press Submit.</p>
      </div>
    </header>

    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-12"
    >
      <SelectField wrapperClassName="xl:col-span-6" label="VLC Name" value={value.vlcId} onChange={(vlcId) => onChange({ vlcId })} options={options} />
      <Field label="Milk Type" className="xl:col-span-3">
        <Segmented<KindFilter> label="Milk Type" value={value.milkType} onChange={(milkType) => onChange({ milkType })} options={KIND_FILTER_OPTIONS} className={SEGMENT} />
      </Field>
      <Field label="Shift" className="xl:col-span-3">
        <Segmented<ShiftFilter> label="Shift" value={value.shift} onChange={(shift) => onChange({ shift })} options={SHIFT_FILTER_OPTIONS} className={SEGMENT} />
      </Field>

      <div className="grid grid-cols-1 items-start gap-2 min-[480px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:col-span-2 xl:col-span-6">
        <TextField label="From Date" type="date" icon={<CalendarDays size={16} />} value={value.fromDate} max={value.toDate || undefined} onChange={(e) => onChange({ fromDate: e.target.value })} />
        <ArrowRight size={16} className="mt-[2.4rem] hidden text-mute min-[480px]:block" aria-hidden />
        <TextField label="To Date" type="date" icon={<CalendarDays size={16} />} value={value.toDate} min={value.fromDate || undefined} onChange={(e) => onChange({ toDate: e.target.value })} error={error} />
      </div>

      <div className="flex items-end sm:col-span-2 xl:col-span-6">
        <Button type="submit" size="lg" loading={loading} icon={<Search size={16} aria-hidden />} className="group h-11 w-full bg-gradient-to-r from-brand to-glow">
          Submit
        </Button>
      </div>
    </form>
  </section>
);

/* ---------- Page ---------- */

const defaults = (): Filters => {
  const today = toISO(new Date());
  return { vlcId: 'all', milkType: 'both', shift: 'both', fromDate: today, toDate: today };
};

const COLUMNS: Column<VlccRow>[] = [
  { key: 'station', header: 'Station Id', cell: (r) => <span className="tnum rounded-md bg-soft px-2 py-0.5 text-xs font-semibold">{r.stationId}</span>, mobile: 'hidden' },
  {
    key: 'village',
    header: 'Village',
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-semibold">{r.village}</p>
        <p className="tnum text-xs font-normal text-mute md:hidden">Station {r.stationId}</p>
      </div>
    ),
    mobile: 'title',
  },
  { key: 'date', header: 'Date', cell: (r) => <span className="tnum whitespace-nowrap">{fmtDate(r.date)}</span> },
  {
    key: 'shift',
    header: 'Shift',
    cell: (r) => (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', r.shift === 'Morning' ? 'bg-warn/12 text-warn' : 'bg-brand/10 text-brand')}>
        {r.shift === 'Morning' ? <Sun size={12} aria-hidden /> : <Moon size={12} aria-hidden />}
        {r.shift}
      </span>
    ),
  },
  { key: 'totalLiter', header: 'Total Liter', align: 'right', cell: (r) => <span className="tnum font-semibold">{nf(r.totalLiter, 1)}</span> },
  { key: 'avgFat', header: 'Avg Fat', align: 'right', cell: (r) => <span className="tnum">{nf(r.avgFat, 2)}</span> },
  { key: 'avgSnf', header: 'Avg SNF', align: 'right', cell: (r) => <span className="tnum">{nf(r.avgSnf, 2)}</span> },
  { key: 'avgRate', header: 'Avg Rate', align: 'right', cell: (r) => <span className="tnum">₹{nf(r.avgRate, 2)}</span> },
  { key: 'totalAmount', header: 'Total Amount', align: 'right', cell: (r) => <span className="tnum font-bold">₹{nf(r.totalAmount, 2)}</span> },
];

const VlccCollectionReport: React.FC = () => {
  const centres = useMilkCenterOptions();
  const vlcOptions = useMemo(() => [{ value: 'all', label: 'All' }, ...centres.map((c) => ({ value: c.id, label: c.label }))], [centres]);
  const [draft, setDraft] = useState<Filters>(defaults);
  const [applied, setApplied] = useState<Filters>(defaults);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const toast = useToast();
  const live = useMilkVlccEntries({ from: applied.fromDate, to: applied.toDate, shift: applied.shift, milk: applied.milkType, vlccId: applied.vlcId }, submitted);
  const loading = live.loading;
  const rows = useMemo(() => {
    const groups = new Map<string, typeof live.rows>();
    for (const r of live.rows) { const key = `${r.vlccid}|${r.date}|${r.shift}`; groups.set(key, [...(groups.get(key) ?? []), r]); }
    return [...groups].map(([id, list]) => { const first = list[0]; const litres = list.reduce((a, r) => a + r.liter, 0); const amount = list.reduce((a, r) => a + r.amount, 0); return { id, stationId: first?.vlccid ?? '', village: first?.village ?? '', date: first?.date ?? '', shift: first?.shift ?? 'Morning', totalLiter: litres, avgFat: litres ? list.reduce((a, r) => a + r.fat*r.liter, 0)/litres : 0, avgSnf: litres ? list.reduce((a, r) => a + r.snf*r.liter, 0)/litres : 0, avgRate: litres ? amount/litres : 0, totalAmount: amount }; }).sort((a,b)=>b.date.localeCompare(a.date)||a.stationId.localeCompare(b.stationId)||a.shift.localeCompare(b.shift));
  }, [live.rows]);
  const pager = usePagination(rows);

  const totals = useMemo(() => {
    const litres = rows.reduce((a, r) => a + r.totalLiter, 0);
    return {
      litres,
      fat: litres ? rows.reduce((a, r) => a + r.avgFat * r.totalLiter, 0) / litres : 0,
      snf: litres ? rows.reduce((a, r) => a + r.avgSnf * r.totalLiter, 0) / litres : 0,
      vlcs: new Set(rows.map((r) => r.stationId)).size,
      amount: rows.reduce((a, r) => a + r.totalAmount, 0),
    };
  }, [rows]);

  const submit = () => {
    if (draft.fromDate > draft.toDate) {
      setError('From date cannot be after To date');
      return;
    }
    setError(undefined);
    if (submitted && JSON.stringify(applied) === JSON.stringify(draft)) { live.retry(); }
    setApplied(draft);
    setSubmitted(true);
    pager.reset();
  };

  const tbl = useReportTable('vlcccollection', COLUMNS);
  const buildTable = (): ExportTable => ({
    filename: `vlcc-collection-report-${applied.fromDate}-${applied.toDate}`,
    title: 'Vlcc collection report',
    subtitle: `${applied.shift === 'both' ? 'Morning & Evening' : applied.shift}  |  ${applied.milkType === 'both' ? 'Cow & Buffalo' : applied.milkType}  |  ${fmtDate(applied.fromDate)} to ${fmtDate(applied.toDate)}`,
    columns: tbl.pick([
      { header: 'Station Id' }, { header: 'Village' }, { header: 'Date' }, { header: 'Shift' }, { header: 'Total Liter', type: 'dec1' },
      { header: 'Avg Fat', type: 'dec2' }, { header: 'Avg SNF', type: 'dec2' }, { header: 'Avg Rate', type: 'money' }, { header: 'Total Amount', type: 'money' },
    ] as ExportTable['columns']),
    rows: rows.map((r) => tbl.pick<string | number>([r.stationId, r.village, fmtDate(r.date), r.shift, r.totalLiter, r.avgFat, r.avgSnf, r.avgRate, r.totalAmount])),
    totals: tbl.pickTotals(['Total', `${rows.length} rows`, '', '', Math.round(totals.litres * 10) / 10, Math.round(totals.fat * 100) / 100, Math.round(totals.snf * 100) / 100, totals.litres ? Math.round((totals.amount / totals.litres) * 100) / 100 : 0, Math.round(totals.amount * 100) / 100]),
  });

  const actions: ExportAction[] = reportActions({ build: buildTable, count: rows.length, unit: 'rows', toast: toast.show, without: ['print'] });

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Vlcc Collection Report" subtitle="Daily collection of every VLC, by shift and milk type." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard index={0} tone="brand" label="Total Liter" note="Litres collected" icon={Milk} value={totals.litres} format={(n) => nf(n, 1)} />
        <StatCard index={1} tone="ok" label="Fat" note="Weighted average %" icon={Droplets} value={totals.fat} format={(n) => nf(n, 2)} />
        <StatCard index={2} tone="warn" label="Snf" note="Weighted average %" icon={FlaskConical} value={totals.snf} format={(n) => nf(n, 2)} />
        <StatCard index={3} tone="danger" label="Total VLC" note="Reporting in this range" icon={Store} value={totals.vlcs} format={(n) => nf(Math.round(n))} />
      </div>

      <VlccFilters value={draft} options={vlcOptions} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} onSubmit={submit} error={error} loading={loading} />

      {live.error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{live.error} <button className="ml-2 underline" onClick={live.retry}>Retry</button></div>}
      <PartialNotice failed={live.failed} total={live.total} onRetry={live.retry} />

      <Panel bodyClassName="!p-0">
        {!submitted ? (
          <EmptyState icon={SlidersHorizontal} title="Set your filters first" text="Choose the options above and press Submit to load the data." />
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
          <ReportLoader label="Loading VLC collection report…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No collection found" text="Try another VLC, date range, shift or milk type." />
        ) : (
          <DataTable columns={tbl.columns} rows={pager.visible} rowKey={(r) => r.id} ariaLabel="Vlcc collection report" loading={loading} minWidth={900} />
        )}

        {!loading && rows.length > 0 && (
          <Pagination page={pager.page} pageSize={pager.pageSize} total={pager.total} onPage={pager.goTo} onPageSize={pager.setPageSize} showSize={false} />
        )}
          </>
        )}
      </Panel>

      <Toast message={toast.message} onClose={toast.close} />
    </div>
  );
};

export default VlccCollectionReport;
