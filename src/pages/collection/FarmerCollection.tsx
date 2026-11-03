import type * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Droplets, FlaskConical, Milk, Moon, Search, SearchX, SlidersHorizontal, Sun, Users } from 'lucide-react';
import type { CollectionEntry } from '../../data/farmerCollection';
import { useMilkFarmerEntries, useMilkCenterOptions, usePlantOptions } from '../../hooks/useMilkReportData';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { reportActions } from '../../components/ui/reportActions';
import { PartialNotice } from '../../components/ui/PartialNotice';
import type { ExportTable } from '../../lib/exporters';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { KindChip } from '../../components/ui/KindChip';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { Panel } from '../../components/ui/Panel';
import { StatCard } from '../../components/ui/StatCard';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Toast } from '../../components/ui/Toast';
import { usePagination } from '../../hooks/usePagination';
import { useReportColumns } from '../../hooks/useSessionData';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/cn';
import { fmtDate, nf, toISO } from '../../lib/format';
import { KIND_OPTIONS, SHIFT_OPTIONS, type Shift } from '../../data/masters';
import type { MilkKind } from '../../types';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { Field, SelectField, TextField } from '../../components/ui/Fields';
import { Segmented } from '../../components/ui/Segmented';

/* ---------- Filter card ---------- */

type KindFilter = MilkKind | 'both';
type ShiftFilter = Shift | 'both';

const KIND_FILTER_OPTIONS: { value: KindFilter; label: string }[] = [...KIND_OPTIONS, { value: 'both', label: 'Both' }];
const SHIFT_FILTER_OPTIONS: { value: ShiftFilter; label: string }[] = [...SHIFT_OPTIONS, { value: 'both', label: 'Both' }];

interface CollectionFilters {
  plant: string;
  centre: string;
  kind: KindFilter;
  shift: ShiftFilter;
  from: string;
  to: string;
}

interface FilterProps {
  value: CollectionFilters;
  plantOptions: { value: string; label: string }[];
  centreOptions: { value: string; label: string }[];
  onChange: (patch: Partial<CollectionFilters>) => void;
  onSubmit: () => void;
  error?: string;
  loading?: boolean;
}

const SEGMENT = 'w-full [&>button]:h-9 [&>button]:flex-1';

const FarmerCollectionFilters: React.FC<FilterProps> = ({ value, plantOptions, centreOptions, onChange, onSubmit, error, loading }) => {

  return (
    <section aria-label="User Info" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
      <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-card">
          <SlidersHorizontal size={17} aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold leading-tight">User Info</h2>
          <p className="text-xs text-mute">Pick the plant, centre, milk and dates, then press Submit.</p>
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
        <SelectField wrapperClassName="xl:col-span-3" label="Plant/MCC Name" value={value.plant} onChange={(plant) => onChange({ plant, centre: 'all' })} options={plantOptions} />
        <SelectField wrapperClassName="xl:col-span-3" label="VLC Name" value={value.centre} onChange={(centre) => onChange({ centre })} options={centreOptions} />

        <Field label="Milk Type" className="xl:col-span-3">
          <Segmented<KindFilter> label="Milk Type" value={value.kind} onChange={(kind) => onChange({ kind })} options={KIND_FILTER_OPTIONS} className={SEGMENT} />
        </Field>
        <Field label="Shift" className="xl:col-span-3">
          <Segmented<ShiftFilter> label="Shift" value={value.shift} onChange={(shift) => onChange({ shift })} options={SHIFT_FILTER_OPTIONS} className={SEGMENT} />
        </Field>

        <div className="grid grid-cols-1 items-start gap-2 min-[480px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:col-span-2 xl:col-span-6">
          <TextField label="From Date" type="date" icon={<CalendarDays size={16} />} value={value.from} max={value.to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
          <ArrowRight size={16} className="mt-[2.4rem] hidden text-mute min-[480px]:block" aria-hidden />
          <TextField label="To Date" type="date" icon={<CalendarDays size={16} />} value={value.to} min={value.from || undefined} onChange={(e) => onChange({ to: e.target.value })} error={error} />
        </div>

        <div className="flex items-end sm:col-span-2 xl:col-span-6">
          <Button type="submit" size="lg" loading={loading} icon={<Search size={16} aria-hidden />} className="group h-11 w-full bg-gradient-to-r from-brand to-glow">
            Submit
          </Button>
        </div>
      </form>
    </section>
  );
};

/* ---------- Page ---------- */

const defaults = (): CollectionFilters => {
  const today = toISO(new Date());
  return { plant: 'all', centre: 'all', kind: 'both', shift: 'both', from: today, to: today };
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
  { key: 'sample', header: 'Sample No', cell: (r) => <span className="tnum">{r.sampleNo ?? ''}</span>, mobile: 'hidden' },
  { key: 'litres', header: 'Liter', align: 'right', cell: (r) => <span className="tnum font-semibold">{nf(r.litres, 1)}</span> },
  { key: 'kg', header: 'Kg', align: 'right', cell: (r) => <span className="tnum">{nf(r.kg ?? 0, 1)}</span>, mobile: 'hidden' },
  { key: 'fat', header: 'Fat', align: 'right', cell: (r) => <span className="tnum">{nf(r.fat, 1)}</span> },
  { key: 'snf', header: 'Snf', align: 'right', cell: (r) => <span className="tnum">{nf(r.snf, 1)}</span> },
  { key: 'clr', header: 'CLR', align: 'right', cell: (r) => <span className="tnum">{nf(r.clr ?? 0, 1)}</span>, mobile: 'hidden' },
  { key: 'water', header: 'Water', align: 'right', cell: (r) => <span className="tnum">{nf(r.water ?? 0, 1)}</span>, mobile: 'hidden' },
  { key: 'time', header: 'Time', cell: (r) => <span className="tnum">{r.time}</span> },
  { key: 'rate', header: 'Rate', align: 'right', cell: (r) => <span className="tnum">₹{nf(r.rate, 2)}</span> },
  { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <span className="tnum font-bold">₹{nf(r.amount, 2)}</span> },
];

/** Report-access column names (userReportConfig) each table column can be called by. */
const COLUMN_ALIASES: Record<string, string[]> = {
  station: ['stationid', 'station'],
  date: ['date', 'trdate', 'collectiondate'],
  shift: ['shift'],
  kind: ['milktype', 'milk'],
  farmerId: ['farmerid', 'farmercode'],
  name: ['name', 'farmername'],
  centre: ['centre', 'centrevlc', 'vlc', 'vlcname', 'villagename'],
  sample: ['sampleno', 'sample', 'sampleid'],
  litres: ['liter', 'litre', 'litres', 'qty'],
  kg: ['kg', 'weight'],
  fat: ['fat'],
  snf: ['snf'],
  clr: ['clr'],
  water: ['water'],
  time: ['time'],
  rate: ['rate', 'rtpl'],
  amount: ['amount', 'amt'],
};

/** Export columns, same keys as COLUMNS, so hidden columns are also left out of Excel / PDF / CSV. */
type ExportCol = { key: string; header: string; type?: 'dec1' | 'money'; value: (r: CollectionEntry) => string | number };
const EXPORT_COLS: ExportCol[] = [
  { key: 'station', header: 'Station Id', value: (r) => r.stationId },
  { key: 'date', header: 'Date', value: (r) => fmtDate(r.date) },
  { key: 'shift', header: 'Shift', value: (r) => r.shift },
  { key: 'kind', header: 'Milk Type', value: (r) => r.kind },
  { key: 'farmerId', header: 'Farmer Id', value: (r) => r.farmerId },
  { key: 'name', header: 'Name', value: (r) => r.farmer },
  { key: 'centre', header: 'Centre (VLC)', value: (r) => r.centre },
  { key: 'sample', header: 'Sample No', value: (r) => r.sampleNo ?? '' },
  { key: 'litres', header: 'Liter', type: 'dec1', value: (r) => r.litres },
  { key: 'kg', header: 'Kg', type: 'dec1', value: (r) => r.kg ?? 0 },
  { key: 'fat', header: 'Fat', type: 'dec1', value: (r) => r.fat },
  { key: 'snf', header: 'Snf', type: 'dec1', value: (r) => r.snf },
  { key: 'clr', header: 'CLR', type: 'dec1', value: (r) => r.clr ?? 0 },
  { key: 'water', header: 'Water', type: 'dec1', value: (r) => r.water ?? 0 },
  { key: 'time', header: 'Time', value: (r) => r.time },
  { key: 'rate', header: 'Rate', type: 'money', value: (r) => r.rate },
  { key: 'amount', header: 'Amount', type: 'money', value: (r) => r.amount },
];

const FarmerCollection: React.FC = () => {
  const centres = useMilkCenterOptions();
  const plantOptions = usePlantOptions(centres);
  const [draft, setDraft] = useState<CollectionFilters>(defaults);
  const [applied, setApplied] = useState<CollectionFilters>(defaults);
  const [submitted, setSubmitted] = useState(false);
  const centreOptions = useMemo(() => [{ value: 'all', label: 'All' }, ...centres.filter((c) => draft.plant === 'all' || c.mccId === draft.plant).map((c) => ({ value: c.id, label: c.label }))], [centres, draft.plant]);
  const live = useMilkFarmerEntries({ from: applied.from, to: applied.to, shift: applied.shift, milk: applied.kind }, submitted);
  const [error, setError] = useState<string | undefined>();
  const toast = useToast();
  const loading = live.loading;

  // userReportConfig -> report[0] = Farmer Collection: only the columns allowed for this login are shown / exported
  const access = useReportColumns('farmercollection');
  const columns = useMemo(() => access.arrange(COLUMNS, (c) => c.key, COLUMN_ALIASES), [access]);
  const shownKeys = useMemo(() => new Set(columns.map((c) => c.key)), [columns]);

  const rows = useMemo(() => live.rows.filter((r) =>
    (applied.plant === 'all' || r.plant === applied.plant) &&
    (applied.centre === 'all' || r.stationId === applied.centre) &&
    (applied.kind === 'both' || r.kind === applied.kind) &&
    (applied.shift === 'both' || r.shift === applied.shift) && r.date >= applied.from && r.date <= applied.to
  ), [live.rows, applied]);

  const pager = usePagination(rows);

  const totals = useMemo(() => {
    const litres = rows.reduce((a, r) => a + r.litres, 0);
    return {
      litres,
      fat: weighted(rows, (r) => r.fat, litres),
      snf: weighted(rows, (r) => r.snf, litres),
      farmers: new Set(rows.map((r) => `${r.stationId}:${r.farmerId}`)).size,
      amount: rows.reduce((a, r) => a + r.amount, 0),
    };
  }, [rows]);

  const submit = () => {
    if (draft.from > draft.to) {
      setError('From date cannot be after To date');
      return;
    }
    setError(undefined);
    if (submitted && JSON.stringify(applied) === JSON.stringify(draft)) { live.retry(); }
    setApplied(draft);
    setSubmitted(true);
    pager.reset();
  };

  const buildTable = (): ExportTable => {
    const cols = columns.map((c) => EXPORT_COLS.find((e) => e.key === c.key)).filter((e): e is ExportCol => !!e);
    const total = (key: string): string | number => {
      if (key === 'name') return `${rows.length} entries`;
      if (key === 'litres') return Math.round(totals.litres * 10) / 10;
      if (key === 'fat') return Math.round(totals.fat * 100) / 100;
      if (key === 'snf') return Math.round(totals.snf * 100) / 100;
      if (key === 'amount') return Math.round(totals.amount * 100) / 100;
      return '';
    };
    return {
      filename: `farmer-collection-${applied.from}-${applied.to}`,
      title: 'Farmer collection',
      subtitle: `${applied.plant}  |  ${applied.shift === 'both' ? 'Morning & Evening' : applied.shift}  |  ${applied.kind === 'both' ? 'Cow & Buffalo' : applied.kind}  |  ${fmtDate(applied.from)} to ${fmtDate(applied.to)}`,
      columns: cols.map((c) => (c.type ? { header: c.header, type: c.type } : { header: c.header })),
      rows: rows.map((r) => cols.map((c) => c.value(r))),
      totals: cols.map((c, i) => (i === 0 ? 'Total' : total(c.key))),
    };
  };

  const actions: ExportAction[] = reportActions({ build: buildTable, count: rows.length, unit: 'entries', toast: toast.show, legacyExcel: true });

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Farmer Collection" subtitle="Litres, fat, SNF, rate and amount for every farmer, by plant, centre and shift." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard index={0} tone="brand" label="Total Liter" note="Litres collected" icon={Milk} value={totals.litres} format={(n) => nf(n, 1)} />
        <StatCard index={1} tone="ok" label="Fat" note="Weighted average %" icon={Droplets} value={totals.fat} format={(n) => nf(n, 2)} />
        <StatCard index={2} tone="warn" label="Snf" note="Weighted average %" icon={FlaskConical} value={totals.snf} format={(n) => nf(n, 2)} />
        <StatCard index={3} tone="danger" label="Total Farmer" note="Pouring in this range" icon={Users} value={totals.farmers} format={(n) => nf(Math.round(n))} />
      </div>

      <FarmerCollectionFilters value={draft} plantOptions={plantOptions} centreOptions={centreOptions} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} onSubmit={submit} error={error} loading={loading} />

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
          <ReportLoader label="Loading farmer collection…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No collection found" text="Try another date range, shift or milk type." />
        ) : (
          <DataTable columns={columns} rows={pager.visible} rowKey={(r) => r.id} ariaLabel="Farmer collection" loading={loading} minWidth={Math.max(520, shownKeys.size * 73)} />
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

export default FarmerCollection;