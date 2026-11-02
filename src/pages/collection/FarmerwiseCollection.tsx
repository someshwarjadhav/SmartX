import type * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Droplets, FileSpreadsheet, FileText, FlaskConical, Milk, Moon, Search, SearchX, SlidersHorizontal, Sun, Table2, Users } from 'lucide-react';
import type { CollectionEntry } from '../../data/farmerCollection';
import { useMilkFarmerEntries, useMilkCenterOptions } from '../../hooks/useMilkReportData';
import { KIND_OPTIONS, SHIFT_OPTIONS, type Shift } from '../../data/masters';
import type { MilkKind } from '../../types';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { Field, SelectField, TextField } from '../../components/ui/Fields';
import { KindChip } from '../../components/ui/KindChip';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { Panel } from '../../components/ui/Panel';
import { Segmented } from '../../components/ui/Segmented';
import { StatCard } from '../../components/ui/StatCard';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Toast } from '../../components/ui/Toast';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { exportCSV, exportExcel, exportPDF, type ExportTable } from '../../lib/exporters';
import { cn } from '../../lib/cn';
import { fmtDate, nf, toISO } from '../../lib/format';

/* ---------- Filter card ---------- */

type KindFilter = MilkKind | 'both';
type ShiftFilter = Shift | 'both';

const KIND_FILTER_OPTIONS: { value: KindFilter; label: string }[] = [...KIND_OPTIONS, { value: 'both', label: 'Both' }];
const SHIFT_FILTER_OPTIONS: { value: ShiftFilter; label: string }[] = [...SHIFT_OPTIONS, { value: 'both', label: 'Both' }];

/**
 * Filter keys = API request params. When the real API arrives, send this object as-is
 * (plant -> Plant/MCC Name, vlcId -> VLC Name, farmerId -> Farmer Name,
 *  milkType -> Milk Type, shift -> Shift, fromDate -> From Date, toDate -> To Date).
 */
interface Filters {
  plant: string;
  vlcId: string;
  farmerId: string;
  milkType: KindFilter;
  shift: ShiftFilter;
  fromDate: string;
  toDate: string;
}

interface FilterProps {
  value: Filters;
  plantOptions: { value: string; label: string }[];
  centreOptions: { value: string; label: string }[];
  farmerOptions: { value: string; label: string }[];
  onChange: (patch: Partial<Filters>) => void;
  onSubmit: () => void;
  error?: string;
  loading?: boolean;
}

const SEGMENT = 'w-full [&>button]:h-9 [&>button]:flex-1';

const FarmerwiseFilters: React.FC<FilterProps> = ({ value, plantOptions, centreOptions, farmerOptions, onChange, onSubmit, error, loading }) => {

  const changePlant = (plant: string) => onChange({ plant, vlcId: 'all', farmerId: 'all' });

  return (
    <section aria-label="User Info" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
      <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-card">
          <SlidersHorizontal size={17} aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold leading-tight">User Info</h2>
          <p className="text-xs text-mute">Pick the plant, centre, farmer, milk and dates, then press Submit.</p>
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
        <SelectField wrapperClassName="xl:col-span-4" label="Plant/MCC Name" value={value.plant} onChange={changePlant} options={plantOptions} />
        <SelectField wrapperClassName="xl:col-span-4" label="VLC Name" value={value.vlcId} onChange={(vlcId) => onChange({ vlcId, farmerId: 'all' })} options={centreOptions} />
        <SelectField wrapperClassName="xl:col-span-4" label="Farmer Name" value={value.farmerId} onChange={(farmerId) => onChange({ farmerId })} options={farmerOptions} />

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

        <div className="sm:col-span-2 xl:col-span-12">
          <Button type="submit" size="lg" loading={loading} icon={<Search size={16} aria-hidden />} className="group h-11 w-full bg-gradient-to-r from-brand to-glow">
            Submit
          </Button>
        </div>
      </form>
    </section>
  );
};

/* ---------- Page ---------- */

const defaults = (): Filters => {
  const today = toISO(new Date());
  const plant = 'all';
  return { plant, vlcId: 'all', farmerId: 'all', milkType: 'cow', shift: 'Morning', fromDate: today, toDate: today };
};

const weighted = (rows: CollectionEntry[], pick: (r: CollectionEntry) => number, litres: number): number =>
  litres ? rows.reduce((a, r) => a + pick(r) * r.litres, 0) / litres : 0;

const COLUMNS: Column<CollectionEntry>[] = [
  { key: 'station', header: 'Station Id', cell: (r) => <span className="tnum rounded-md bg-soft px-2 py-0.5 text-xs font-semibold">{r.stationId}</span>, mobile: 'hidden' },
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
  { key: 'kind', header: 'Milk Type', cell: (r) => <KindChip kind={r.kind} /> },
  { key: 'farmerId', header: 'Farmer Id', cell: (r) => <span className="tnum">{r.farmerId}</span> },
  {
    key: 'name',
    header: 'Name',
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate font-semibold">{r.farmer}</p>
        <p className="tnum text-xs font-normal text-mute md:hidden">Station {r.stationId}</p>
      </div>
    ),
    mobile: 'title',
  },
  { key: 'centre', header: 'Centre (VLC)', cell: (r) => <span className="whitespace-nowrap">{r.centre}</span>, mobile: 'hidden' },
  { key: 'litres', header: 'Liter', align: 'right', cell: (r) => <span className="tnum font-semibold">{nf(r.litres, 1)}</span> },
  { key: 'kg', header: 'Kg', align: 'right', cell: (r) => <span className="tnum">{nf(r.kg ?? 0, 1)}</span>, mobile: 'hidden' },
  { key: 'fat', header: 'Fat', align: 'right', cell: (r) => <span className="tnum">{nf(r.fat, 1)}</span> },
  { key: 'snf', header: 'Snf', align: 'right', cell: (r) => <span className="tnum">{nf(r.snf, 1)}</span> },
  { key: 'clr', header: 'CLR', align: 'right', cell: (r) => <span className="tnum">{nf(r.clr ?? 0, 1)}</span>, mobile: 'hidden' },
  { key: 'rate', header: 'Rate', align: 'right', cell: (r) => <span className="tnum">₹{nf(r.rate, 2)}</span> },
  { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <span className="tnum font-bold">₹{nf(r.amount, 2)}</span> },
];


const FarmerwiseCollection: React.FC = () => {
  const centres = useMilkCenterOptions();
  const plantOptions = useMemo(() => [{ value: 'all', label: 'All MCCs' }, ...Array.from(new Map(centres.map((c) => [c.mccId, c.mccId])).keys()).map((id) => ({ value: id, label: id }))], [centres]);
  const [draft, setDraft] = useState<Filters>(defaults);
  const [applied, setApplied] = useState<Filters>(defaults);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const toast = useToast();
  const live = useMilkFarmerEntries({ from: applied.fromDate, to: applied.toDate, shift: applied.shift, milk: applied.milkType }, submitted);
  const loading = live.loading;
  const centreOptions = useMemo(() => [{ value: 'all', label: 'All' }, ...centres.filter((c) => draft.plant === 'all' || c.mccId === draft.plant).map((c) => ({ value: c.id, label: c.label }))], [centres, draft.plant]);
  const farmerOptions = useMemo(() => [{ value: 'all', label: 'All' }, ...live.rows.filter((r) => draft.vlcId === 'all' || r.stationId === draft.vlcId).map((r) => ({ value: r.farmerId, label: `${r.farmer} | ${r.farmerId}` })).filter((o, i, a) => a.findIndex((x) => x.value === o.value) === i)], [live.rows, draft.vlcId]);
  const rows = useMemo(() => live.rows.filter((r) => (applied.plant === 'all' || r.plant === applied.plant) && (applied.vlcId === 'all' || r.stationId === applied.vlcId) && (applied.farmerId === 'all' || r.farmerId === applied.farmerId) && (applied.milkType === 'both' || r.kind === applied.milkType) && (applied.shift === 'both' || r.shift === applied.shift) && r.date >= applied.fromDate && r.date <= applied.toDate), [live.rows, applied]);

  const pager = usePagination(rows);

  const totals = useMemo(() => {
    const litres = rows.reduce((a, r) => a + r.litres, 0);
    return {
      litres,
      fat: weighted(rows, (r) => r.fat, litres),
      snf: weighted(rows, (r) => r.snf, litres),
      farmers: new Set(rows.map((r) => r.farmerId)).size,
      amount: rows.reduce((a, r) => a + r.amount, 0),
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

  const buildTable = (): ExportTable => ({
    filename: `farmerwise-collection-${applied.fromDate}-${applied.toDate}`,
    title: 'Farmerwise collection',
    subtitle: `${applied.plant}  |  ${applied.shift === 'both' ? 'Morning & Evening' : applied.shift}  |  ${applied.milkType === 'both' ? 'Cow & Buffalo' : applied.milkType}  |  ${fmtDate(applied.fromDate)} to ${fmtDate(applied.toDate)}`,
    columns: [
      { header: 'Station Id' }, { header: 'Date' }, { header: 'Shift' }, { header: 'Milk Type' }, { header: 'Farmer Id' }, { header: 'Name' },
      { header: 'Centre (VLC)' }, { header: 'Liter', type: 'dec1' }, { header: 'Kg', type: 'dec1' }, { header: 'Fat', type: 'dec1' }, { header: 'Snf', type: 'dec1' }, { header: 'CLR', type: 'dec1' }, { header: 'Rate', type: 'money' }, { header: 'Amount', type: 'money' },
    ],
    rows: rows.map((r) => [r.stationId, fmtDate(r.date), r.shift, r.kind, r.farmerId, r.farmer, r.centre, r.litres, r.kg ?? 0, r.fat, r.snf, r.clr ?? 0, r.rate, r.amount]),
    totals: ['Total', '', '', '', '', `${rows.length} entries`, '', Math.round(totals.litres * 10) / 10, '', Math.round(totals.fat * 100) / 100, Math.round(totals.snf * 100) / 100, '', '', Math.round(totals.amount * 100) / 100],
  });

  const exportAs = (label: string, run: (t: ExportTable) => void | Promise<void>) => async () => {
    try {
      await run(buildTable());
      toast.show(`Exported ${rows.length} entries as ${label}`);
    } catch {
      toast.show('Export failed. Please try again.');
    }
  };

  const actions: ExportAction[] = [
    { id: 'excel', label: 'Excel Export', icon: FileSpreadsheet, variant: 'primary', run: exportAs('Excel', exportExcel) },
    { id: 'pdf', label: 'PDF Export', icon: FileText, variant: 'danger', run: exportAs('PDF', exportPDF) },
    { id: 'csv', label: 'CSV Export', icon: Table2, variant: 'success', run: exportAs('CSV', exportCSV) },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Farmerwise Collection" subtitle="Litres, fat, SNF, rate and amount for one farmer or the whole centre, by shift and date." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard index={0} tone="brand" label="Total Liter" note="Litres collected" icon={Milk} value={totals.litres} format={(n) => nf(n, 1)} />
        <StatCard index={1} tone="ok" label="Fat" note="Weighted average %" icon={Droplets} value={totals.fat} format={(n) => nf(n, 2)} />
        <StatCard index={2} tone="warn" label="Snf" note="Weighted average %" icon={FlaskConical} value={totals.snf} format={(n) => nf(n, 2)} />
        <StatCard index={3} tone="danger" label="Total Farmer" note="Pouring in this range" icon={Users} value={totals.farmers} format={(n) => nf(Math.round(n))} />
      </div>

      <FarmerwiseFilters value={draft} plantOptions={plantOptions} centreOptions={centreOptions} farmerOptions={farmerOptions} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} onSubmit={submit} error={error} loading={loading} />

      {live.error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{live.error} <button className="ml-2 underline" onClick={live.retry}>Retry</button></div>}

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
          <ReportLoader label="Loading farmerwise collection…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No collection found" text="Try another farmer, date range, shift or milk type." />
        ) : (
          <DataTable columns={COLUMNS} rows={pager.visible} rowKey={(r) => r.id} ariaLabel="Farmerwise collection" loading={loading} minWidth={1100} />
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

export default FarmerwiseCollection;
