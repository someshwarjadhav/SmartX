import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Droplets, FlaskConical, Milk, Moon, Search, SearchX, SlidersHorizontal, Sun, Users } from 'lucide-react';
import type { CollectionEntry } from '../../data/farmerCollection';
import { useMilkFarmerEntries, useMilkCenterOptions, useReportScope, useFarmerMasterOptions, centreIdsFor, farmerKey, apiMilk, apiShift } from '../../hooks/useMilkReportData';
import { useWarmCentres } from '../../hooks/useWarmCentres';
import { withFormulaTotals } from '../../assets/excel/exporters';
import { KIND_OPTIONS, SHIFT_OPTIONS, type Shift } from '../../data/masters';
import type { MilkKind } from '../../types';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { reportActions } from '../../components/ui/reportActions';
import { PartialNotice } from '../../components/ui/PartialNotice';
import type { ExportTable } from '../../assets/excel/exporters';
import { Field, SelectField } from '../../components/ui/Fields';
import { DateRangeFields } from '../../components/ui/DateRangeFields';
import { KindChip } from '../../components/ui/KindChip';
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
import { validateDateRange, validatePastLimit } from '../../lib/dateRange';
import { MSG } from '../../lib/messages';

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

  const changePlant = (plant: string) => onChange({ plant, vlcId: '', farmerId: '' });

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
        <SelectField wrapperClassName="xl:col-span-4" label="VLC Name" value={value.vlcId} onChange={(vlcId) => onChange({ vlcId, farmerId: '' })} options={centreOptions} />
        <SelectField wrapperClassName="xl:col-span-4" label="Farmer Name" value={value.farmerId} onChange={(farmerId) => onChange({ farmerId })} options={farmerOptions} />

        <Field label="Milk Type" className="xl:col-span-3">
          <Segmented<KindFilter> label="Milk Type" value={value.milkType} onChange={(milkType) => onChange({ milkType })} options={KIND_FILTER_OPTIONS} className={SEGMENT} />
        </Field>
        <Field label="Shift" className="xl:col-span-3">
          <Segmented<ShiftFilter> label="Shift" value={value.shift} onChange={(shift) => onChange({ shift })} options={SHIFT_FILTER_OPTIONS} className={SEGMENT} />
        </Field>

        <div className="sm:col-span-2 xl:col-span-6">
          <DateRangeFields
            from={value.fromDate}
            to={value.toDate}
            onChange={({ from, to }) =>
              onChange({
                ...(from !== undefined ? { fromDate: from } : {}),
                ...(to !== undefined ? { toDate: to } : {}),
              })
            }
            error={error}
          />
        </div>

        <div className="sm:col-span-2 xl:col-span-12">
          <Button type="submit" size="lg" disabled={loading} icon={<Search size={16} aria-hidden />} className="group h-11 w-full bg-gradient-to-r from-brand to-glow">
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
  // plant / VLC / farmer '' = first plant, its first centre and that centre's first farmer (no "All" row)
  const plant = '';
  // farmerId '' = the first farmer of the chosen VLC (there is no "All Farmers" row in this report)
  return { plant, vlcId: '', farmerId: '', milkType: 'cow', shift: 'Morning', fromDate: today, toDate: today };
};

const KIND_TEXT: Record<string, string> = { cow: 'Cow', buffalo: 'Buffalo', mix: 'Mix' };

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
  { key: 'centre', header: 'Station Name', cell: (r) => <span className="whitespace-nowrap">{r.centre}</span>, mobile: 'hidden' },
  { key: 'litres', header: 'Liter', align: 'right', cell: (r) => <span className="tnum font-semibold">{nf(r.litres, 1)}</span> },
  { key: 'kg', header: 'Kg', align: 'right', cell: (r) => <span className="tnum">{nf(r.kg ?? 0, 1)}</span>, mobile: 'hidden' },
  { key: 'fat', header: 'Fat', align: 'right', cell: (r) => <span className="tnum">{nf(r.fat, 1)}</span> },
  { key: 'snf', header: 'Snf', align: 'right', cell: (r) => <span className="tnum">{nf(r.snf, 1)}</span> },
  { key: 'clr', header: 'Clr', align: 'right', cell: (r) => <span className="tnum">{nf(r.clr ?? 0, 1)}</span>, mobile: 'hidden' },
  { key: 'rate', header: 'Rate', align: 'right', cell: (r) => <span className="tnum">₹{nf(r.rate, 2)}</span> },
  { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <span className="tnum font-bold">₹{nf(r.amount, 2)}</span> },
];


const FarmerwiseCollection: React.FC = () => {
  const resultsRef = useRef<HTMLDivElement>(null);
  const centres = useMilkCenterOptions();
  const [draft, setDraft] = useState<Filters>(defaults);
  const [applied, setApplied] = useState<Filters>(defaults);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const toast = useToast();
  const scope = useReportScope(centres, draft.plant, draft.vlcId, true);
  const allVlc = applied.vlcId === 'all';
  const askIds = useMemo(() => centreIdsFor(centres, applied.plant, applied.vlcId), [centres, applied.plant, applied.vlcId]);
  const plantOptions = scope.plantOptions;
  const centreOptions = scope.centreOptions;
  const live = useMilkFarmerEntries({ from: applied.fromDate, to: applied.toDate, shift: applied.shift, milk: applied.milkType, vlccId: applied.vlcId || 'all', vlccIds: allVlc ? askIds : undefined }, submitted && !!applied.vlcId);
  useWarmCentres({ ready: submitted && !!applied.vlcId && !allVlc && !live.fetching && !live.error && live.failed === 0, ids: centres.filter((c) => c.mccId === applied.plant && c.id !== applied.vlcId).map((c) => c.id), kind: 'farmer', from: applied.fromDate, to: applied.toDate, shift: apiShift(applied.shift), milk: apiMilk(applied.milkType) });
  const fetching = live.fetching;
  const loading = live.loading;
  // the farmer list belongs to ONE VLC
  const oneVlc = !!scope.centre && scope.centre !== 'all';
  const farmerVlccIds = useMemo(() => (oneVlc ? [scope.centre] : []), [oneVlc, scope.centre]);
  const centreNames = useMemo(() => Object.fromEntries(centres.map((c) => [c.id, c.name || c.id])), [centres]);
  const { options: masterFarmers, loading: farmersLoading } = useFarmerMasterOptions(farmerVlccIds, centreNames);
  // only if the farmer master gave nobody: farmers of the chosen VLC are read from its collection
  const pre = useMilkFarmerEntries({ from: draft.fromDate, to: draft.toDate, shift: 'both', milk: 'both', vlccId: scope.centre || 'all' }, oneVlc && !farmersLoading && masterFarmers.length === 0, false);
  const farmerOptions = useMemo(() => {
    // farmer master (id | name) first; farmers seen in the loaded collection are added if the master missed them
    const have = new Set(masterFarmers.map((o) => o.value));
    const extra: { value: string; label: string }[] = [];
    for (const r of [...pre.rows, ...live.rows]) {
      if (r.stationId !== scope.centre) continue;
      const value = farmerKey(r.stationId, r.farmerId);
      if (have.has(value)) continue;
      have.add(value);
      extra.push({ value, label: `${r.farmerId} | ${r.farmer}` });
    }
    const list = [...masterFarmers, ...extra];
    // no "All Farmers" row: one farmer is always chosen
    return list.length ? list : [{ value: '', label: farmersLoading ? 'Loading farmers…' : 'No farmer found' }];
  }, [masterFarmers, farmersLoading, pre.rows, live.rows, scope.centre]);
  // the farmer shown in the dropdown: the one picked, else the first of the list
  const farmerId = farmerOptions.some((o) => o.value === draft.farmerId && o.value !== '') ? draft.farmerId : farmerOptions[0]?.value ?? '';
  const rows = useMemo(() => live.rows.filter((r) => (!applied.plant || applied.plant === 'all' || r.plant === applied.plant) && (!applied.vlcId || allVlc || r.stationId === applied.vlcId) && (!applied.farmerId || applied.farmerId === 'all' || farmerKey(r.stationId, r.farmerId) === applied.farmerId) && (applied.milkType === 'both' || r.kind === applied.milkType) && (applied.shift === 'both' || r.shift === applied.shift) && r.date >= applied.fromDate && r.date <= applied.toDate), [live.rows, applied]);

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
    const rangeError = validateDateRange(draft.fromDate, draft.toDate) ?? validatePastLimit(draft.fromDate);
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
    if (!farmerId) {
      toast.show(MSG.pickFarmer, 'warn');
      return;
    }
    setError(undefined);
    const next = { ...draft, plant: scope.plant, vlcId: scope.centre, farmerId };
    if (submitted && JSON.stringify(applied) === JSON.stringify(next)) { live.retry(); }
    setApplied(next);
    setSubmitted(true);
    // bring the results (and the loader) up so nothing has to be scrolled
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    pager.reset();
  };

  const tbl = useReportTable('farmerwisecollection', COLUMNS);
  const buildTable = (): ExportTable => withFormulaTotals({
    filename: `farmerwise-collection-${applied.fromDate}-${applied.toDate}`,
    title: 'Farmerwise collection',
    subtitle: `${applied.plant === 'all' ? 'All' : centres.find((c) => c.mccId === applied.plant)?.plantName ?? ''}  |  ${allVlc ? 'All' : centres.find((c) => c.id === applied.vlcId)?.label ?? ''}  |  ${applied.shift === 'both' ? 'Morning & Evening' : applied.shift}  |  ${applied.milkType === 'both' ? 'Cow & Buffalo' : applied.milkType}  |  ${fmtDate(applied.fromDate)} to ${fmtDate(applied.toDate)}`,
    columns: tbl.pick([
      { header: 'Station Id' }, { header: 'Date' }, { header: 'Shift' }, { header: 'Milk Type' }, { header: 'Farmer Id' }, { header: 'Name' },
      { header: 'Station Name' }, { header: 'Liter', type: 'dec1' }, { header: 'Kg', type: 'dec1' }, { header: 'Fat', type: 'dec1' }, { header: 'Snf', type: 'dec1' }, { header: 'Clr', type: 'dec1' }, { header: 'Rate', type: 'money' }, { header: 'Amount', type: 'money' },
    ] as ExportTable['columns']),
    rows: rows.map((r) => tbl.pick<string | number>([r.stationId, fmtDate(r.date), r.shift, KIND_TEXT[r.kind] ?? r.kind, r.farmerId, r.farmer, r.centre, r.litres, r.kg ?? 0, r.fat, r.snf, r.clr ?? 0, r.rate, r.amount])),
    totals: tbl.pickTotals(['Total', '', '', '', '', `${rows.length} entries`, '', Math.round(totals.litres * 10) / 10, '', Math.round(totals.fat * 100) / 100, Math.round(totals.snf * 100) / 100, '', '', Math.round(totals.amount * 100) / 100]),
  });

  const actions: ExportAction[] = reportActions({ build: buildTable, count: rows.length, unit: 'entries', toast: toast.show, without: ['print'] });

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Farmerwise Collection" subtitle="Litres, fat, SNF, rate and amount of one farmer, by shift and date." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard index={0} tone="brand" label="Total Liter" note="Litres collected" icon={Milk} value={totals.litres} format={(n) => nf(n, 1)} />
        <StatCard index={1} tone="ok" label="Fat" note="Weighted average %" icon={Droplets} value={totals.fat} format={(n) => nf(n, 2)} />
        <StatCard index={2} tone="warn" label="Snf" note="Weighted average %" icon={FlaskConical} value={totals.snf} format={(n) => nf(n, 2)} />
        <StatCard index={3} tone="danger" label="Total Farmer" note="Pouring in this range" icon={Users} value={totals.farmers} format={(n) => nf(Math.round(n))} />
      </div>

      <FarmerwiseFilters value={{ ...draft, plant: scope.plant, vlcId: scope.centre, farmerId }} plantOptions={plantOptions} centreOptions={centreOptions} farmerOptions={farmerOptions} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} onSubmit={submit} error={error} loading={fetching} />

      {live.error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{live.error} <button className="ml-2 underline" onClick={live.retry}>Retry</button></div>}
      <PartialNotice failed={live.failed} total={live.total} onRetry={live.retry} />

      <div ref={resultsRef} className="scroll-mt-20">
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
          actions={<ExportBar actions={actions} disabled={fetching || rows.length === 0} />}
        />

        {loading ? (
          <ReportLoader label="Loading farmerwise collection…" done={live.done} total={live.total} />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No collection found" text="Try another farmer, date range, shift or milk type." />
        ) : (
          <DataTable columns={tbl.columns} rows={pager.visible} rowKey={(r) => r.id} ariaLabel="Farmerwise collection" minWidth={1100} />
        )}

        {!loading && rows.length > 0 && (
          <Pagination page={pager.page} pageSize={pager.pageSize} total={pager.total} onPage={pager.goTo} onPageSize={pager.setPageSize} showSize={false} />
        )}
          </>
        )}
      </Panel>
      </div>

      <Toast message={toast.message} onClose={toast.close} />
    </div>
  );
};

export default FarmerwiseCollection;
