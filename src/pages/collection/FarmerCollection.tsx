import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Droplets, FlaskConical, Milk, Moon, Search, SearchX, SlidersHorizontal, Sun, Users } from 'lucide-react';
import type { CollectionEntry } from '../../data/farmerCollection';
import { useMilkFarmerEntries, useMilkCenterOptions, useReportScope, centreIdsFor, apiMilk, apiShift } from '../../hooks/useMilkReportData';
import { useWarmCentres } from '../../hooks/useWarmCentres';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { reportActions } from '../../components/ui/reportActions';
import { PartialNotice } from '../../components/ui/PartialNotice';
import type { ColType, ExportTable } from '../../lib/exporters';
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
import { fmtDate, fmtDateDots, fmtDateLong, nf, time24, toISO } from '../../lib/format';
import { KIND_OPTIONS, SHIFT_OPTIONS, type Shift } from '../../data/masters';
import type { MilkKind } from '../../types';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { Field, SelectField } from '../../components/ui/Fields';
import { DateRangeFields } from '../../components/ui/DateRangeFields';
import { Segmented } from '../../components/ui/Segmented';
import { validateDateRange, validatePastLimit } from '../../lib/dateRange';
import { MSG } from '../../lib/messages';
import { BANSI_USER_IDS, exportBansiAllExcel, isBansiAll } from '../../lib/bansiExcel';
import { GLOBALS } from '../../lib/portal/global';

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
        <SelectField wrapperClassName="xl:col-span-3" label="Plant/MCC Name" value={value.plant} onChange={(plant) => onChange({ plant, centre: '' })} options={plantOptions} />
        <SelectField wrapperClassName="xl:col-span-3" label="VLC Name" value={value.centre} onChange={(centre) => onChange({ centre })} options={centreOptions} />

        <Field label="Milk Type" className="xl:col-span-3">
          <Segmented<KindFilter> label="Milk Type" value={value.kind} onChange={(kind) => onChange({ kind })} options={KIND_FILTER_OPTIONS} className={SEGMENT} />
        </Field>
        <Field label="Shift" className="xl:col-span-3">
          <Segmented<ShiftFilter> label="Shift" value={value.shift} onChange={(shift) => onChange({ shift })} options={SHIFT_FILTER_OPTIONS} className={SEGMENT} />
        </Field>

        <div className="sm:col-span-2 xl:col-span-6">
          <DateRangeFields
            from={value.from}
            to={value.to}
            onChange={(patch) => onChange(patch)}
            error={error}
          />
        </div>

        <div className="flex items-end sm:col-span-2 xl:col-span-6">
          <Button type="submit" size="lg" disabled={loading} icon={<Search size={16} aria-hidden />} className="group h-11 w-full bg-gradient-to-r from-brand to-glow">
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
  // plant / centre '' = the first plant and its first centre (no "All" row in the dropdowns)
  return { plant: '', centre: '', kind: 'both', shift: 'both', from: today, to: today };
};

const weighted = (rows: CollectionEntry[], pick: (r: CollectionEntry) => number, litres: number): number =>
  litres ? rows.reduce((a, r) => a + pick(r) * r.litres, 0) / litres : 0;

const COLUMNS: Column<CollectionEntry>[] = [
  { key: 'station', header: 'Station Id', cell: (r) => <span className="tnum rounded-md bg-soft px-2 py-0.5 text-xs font-semibold">{r.stationCode || r.stationId}</span>, mobile: 'hidden' },
  { key: 'date', header: 'Date', cell: (r) => <span className="tnum whitespace-nowrap">{fmtDateLong(r.date)}</span> },
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
        <p className="tnum text-xs font-normal text-mute md:hidden">Station {r.stationCode || r.stationId}</p>
      </div>
    ),
    mobile: 'title',
  },
  { key: 'centre', header: 'Station Name', cell: (r) => <span className="whitespace-nowrap">{r.centre}</span>, mobile: 'hidden' },
  { key: 'sample', header: 'Sample No', cell: (r) => <span className="tnum">{r.sampleNo ?? ''}</span>, mobile: 'hidden' },
  { key: 'litres', header: 'Liter', align: 'right', cell: (r) => <span className="tnum font-semibold">{nf(r.litres, 2)}</span> },
  { key: 'kg', header: 'Kg', align: 'right', cell: (r) => <span className="tnum">{nf(r.kg ?? 0, 2)}</span>, mobile: 'hidden' },
  { key: 'fat', header: 'Fat', align: 'right', cell: (r) => <span className="tnum">{nf(r.fat, 2)}</span> },
  { key: 'snf', header: 'Snf', align: 'right', cell: (r) => <span className="tnum">{nf(r.snf, 2)}</span> },
  { key: 'clr', header: 'Clr', align: 'right', cell: (r) => <span className="tnum">{nf(r.clr ?? 0, 2)}</span>, mobile: 'hidden' },
  { key: 'water', header: 'Water', align: 'right', cell: (r) => <span className="tnum">{nf(r.water ?? 0, 2)}</span>, mobile: 'hidden' },
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
  centre: ['centre', 'centrevlc', 'vlc', 'vlcname', 'villagename', 'stationname'],
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

/**
 * Export columns for PDF / CSV / Print: same keys as COLUMNS, so columns hidden for this login are left out too.
 * `total` = how the Total row is calculated (see TotalKind in lib/exporters).
 */
type ExportCol = { key: string; header: string; type?: ColType; total?: 'sum' | 'wavg' | 'ratio'; value: (r: CollectionEntry) => string | number };
const EXPORT_COLS: ExportCol[] = [
  { key: 'station', header: 'Station Id', value: (r) => r.stationCode || r.stationId },
  { key: 'date', header: 'Date', value: (r) => fmtDateLong(r.date) },
  { key: 'shift', header: 'Shift', value: (r) => r.shift },
  { key: 'kind', header: 'Milk Type', value: (r) => KIND_TEXT[r.kind] ?? r.kind },
  { key: 'farmerId', header: 'Farmer Id', value: (r) => r.farmerId },
  { key: 'name', header: 'Name', value: (r) => r.farmer },
  { key: 'centre', header: 'Station Name', value: (r) => r.centre },
  { key: 'sample', header: 'Sample No', value: (r) => r.sampleNo ?? '' },
  { key: 'litres', header: 'Liter', type: 'dec2', total: 'sum', value: (r) => r.litres },
  { key: 'kg', header: 'Kg', type: 'dec2', total: 'sum', value: (r) => r.kg ?? 0 },
  { key: 'fat', header: 'Fat', type: 'dec2', total: 'wavg', value: (r) => r.fat },
  { key: 'snf', header: 'Snf', type: 'dec2', total: 'wavg', value: (r) => r.snf },
  { key: 'clr', header: 'Clr', type: 'dec2', total: 'wavg', value: (r) => r.clr ?? 0 },
  { key: 'water', header: 'Water', type: 'dec2', total: 'wavg', value: (r) => r.water ?? 0 },
  { key: 'time', header: 'Time', value: (r) => r.time },
  { key: 'rate', header: 'Rate', type: 'money', total: 'ratio', value: (r) => r.rate },
  { key: 'amount', header: 'Amount', type: 'money', total: 'sum', value: (r) => r.amount },
];

/* ---------- STIPL Excel layouts (Old Excel Export / New Excel Export) ---------- */

const r2 = (n: number): number => Math.round(n * 100) / 100;
const KIND_TEXT: Record<string, string> = { cow: 'Cow', buffalo: 'Buffalo', mix: 'Mix' };

interface SheetCol {
  header: string;
  /** 'sum' | 'wavg' (weighted by Liter) | 'ratio' (Amount / Liter) -> formula in the Total row */
  total?: 'sum' | 'wavg' | 'ratio';
  num?: boolean;
  value: (r: CollectionEntry) => string | number;
}

const SHEET_COLS: Record<string, SheetCol> = {
  station: { header: 'Station Id', value: (r) => r.stationCode || r.stationId },
  date: { header: 'Date', value: (r) => fmtDateLong(r.date) },
  shift: { header: 'Shift', value: (r) => (r.shift === 'Morning' ? 'M' : 'E') },
  kind: { header: 'Milk Type', value: (r) => KIND_TEXT[r.kind] ?? r.kind },
  farmerId: { header: 'Farmer Id', value: (r) => r.farmerId },
  name: { header: 'Name', value: (r) => r.farmer },
  litres: { header: 'Liter', total: 'sum', num: true, value: (r) => r.litres },
  kg: { header: 'Kg', total: 'sum', num: true, value: (r) => r.kg ?? 0 },
  fat: { header: 'Fat', total: 'wavg', num: true, value: (r) => r.fat },
  snf: { header: 'Snf', total: 'wavg', num: true, value: (r) => r.snf },
  clr: { header: 'Clr', total: 'wavg', num: true, value: (r) => r.clr ?? 0 },
  water: { header: 'Water', total: 'wavg', num: true, value: (r) => r.water ?? 0 },
  time: { header: 'Time', value: (r) => r.time },
  rate: { header: 'Rate', total: 'ratio', num: true, value: (r) => r.rate },
  amount: { header: 'Amount', total: 'sum', num: true, value: (r) => r.amount },
  branch: { header: 'BranchId', value: (r) => r.branchId ?? '1' },
  stationName: { header: 'Station Name', value: (r) => r.centre || r.village || '' },
  kgFat: { header: 'Kg Fat', total: 'sum', num: true, value: (r) => r2((r.litres * r.fat) / 100) },
  kgSnf: { header: 'Kg Snf', total: 'sum', num: true, value: (r) => r2((r.litres * r.snf) / 100) },
  collDate: { header: 'Collection Date', value: (r) => fmtDateDots(r.date) },
  collTime: { header: 'Collection Time', value: (r) => time24(r.time) },
  sampleNo: { header: 'Sample No', value: (r) => r.sampleNo ?? '' },
};

/**
 * New Excel Export = the portal's 101010.xlsx: 22 columns, Station Id first, plain data rows only (NO Total row).
 */
const NEW_ORDER = ['station', 'date', 'shift', 'kind', 'farmerId', 'name', 'litres', 'kg', 'fat', 'snf', 'clr', 'water', 'time', 'rate', 'amount', 'branch', 'stationName', 'kgFat', 'kgSnf', 'collDate', 'collTime', 'sampleNo'];
/**
 * Old Excel Export = the portal's farmercollection.xlsx: 22 columns, Date first, plain data rows only (NO Total row).
 * Number columns are real numbers (not text), so selecting a column in Excel shows its Sum.
 */
const OLD_ORDER = ['date', 'farmerId', 'name', 'litres', 'kg', 'fat', 'snf', 'clr', 'water', 'kind', 'time', 'station', 'shift', 'rate', 'amount', 'branch', 'stationName', 'kgFat', 'kgSnf', 'collDate', 'collTime', 'sampleNo'];

/** always a real number (never text) for the numeric columns */
const asNumber = (v: string | number): number => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? r2(n) : 0;
};

function sheetTable(order: string[], rows: CollectionEntry[], filename: string, numType: ColType, withTotal: boolean): ExportTable {
  const cols = order.map((k) => SHEET_COLS[k]).filter((c): c is SheetCol => !!c);
  const at = (key: string): number => cols.findIndex((c) => c.header === SHEET_COLS[key]?.header);
  const litres = at('litres');
  const amount = at('amount');
  return {
    filename,
    title: 'Farmer collection',
    columns: cols.map((c) => ({
      header: c.header,
      ...(c.num ? { type: numType } : {}),
      // Total row only when asked for; the STIPL Old / New Excel pass false, so no Total row is written
      ...(!withTotal ? {} : c.total === 'sum' ? { total: 'sum' as const } : c.total === 'wavg' ? { total: { wavg: litres } } : c.total === 'ratio' ? { total: { ratio: [amount, litres] as [number, number] } } : {}),
    })),
    rows: rows.map((r) => cols.map((c) => (c.num ? asNumber(c.value(r)) : c.value(r)))),
  };
}

const FarmerCollection: React.FC = () => {
  const resultsRef = useRef<HTMLDivElement>(null);
  const centres = useMilkCenterOptions();
  const [draft, setDraft] = useState<CollectionFilters>(defaults);
  const [applied, setApplied] = useState<CollectionFilters>(defaults);
  const [submitted, setSubmitted] = useState(false);
  // dropdowns: real plants / centres plus an "All" row; the first real plant and centre are selected by default
  const scope = useReportScope(centres, draft.plant, draft.centre, true);
  const allCentres = applied.centre === 'all';
  const askIds = useMemo(() => centreIdsFor(centres, applied.plant, applied.centre), [centres, applied.plant, applied.centre]);
  const live = useMilkFarmerEntries({ from: applied.from, to: applied.to, shift: applied.shift, milk: applied.kind, vlccId: applied.centre || 'all', vlccIds: allCentres ? askIds : undefined }, submitted && !!applied.centre);
  // the other centres of this plant are loaded quietly after the report is on screen, so changing the VLC name is instant
  useWarmCentres({ ready: submitted && !!applied.centre && !allCentres && !live.fetching && !live.error && live.failed === 0, ids: centres.filter((c) => c.mccId === applied.plant && c.id !== applied.centre).map((c) => c.id), kind: 'farmer', from: applied.from, to: applied.to, shift: apiShift(applied.shift), milk: apiMilk(applied.kind) });
  const [error, setError] = useState<string | undefined>();
  const toast = useToast();
  const fetching = live.fetching;
  const loading = live.loading;

  // userReportConfig -> report[0] = Farmer Collection: only the columns allowed for this login are shown / exported
  const access = useReportColumns('farmercollection');
  const columns = useMemo(() => access.arrange(COLUMNS, (c) => c.key, COLUMN_ALIASES), [access]);
  const shownKeys = useMemo(() => new Set(columns.map((c) => c.key)), [columns]);

  const rows = useMemo(() => live.rows.filter((r) =>
    (!applied.plant || applied.plant === 'all' || r.plant === applied.plant) &&
    (!applied.centre || applied.centre === 'all' || r.stationId === applied.centre) &&
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
    const rangeError = validateDateRange(draft.from, draft.to) ?? validatePastLimit(draft.from);
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
    const next = { ...draft, plant: scope.plant, centre: scope.centre };
    if (submitted && JSON.stringify(applied) === JSON.stringify(next)) { live.retry(); }
    setApplied(next);
    setSubmitted(true);
    // bring the results (and the loader) up so nothing has to be scrolled
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    pager.reset();
  };

  const plantName = applied.plant === 'all' ? 'All' : centres.find((c) => c.mccId === applied.plant)?.plantName ?? '';
  const centreName = applied.centre === 'all' ? 'All' : centres.find((c) => c.id === applied.centre)?.label ?? '';

  /** PDF / CSV / Print: the columns shown in the table (follows userReportConfig). */
  const buildTable = (): ExportTable => {
    const cols = columns.map((c) => EXPORT_COLS.find((e) => e.key === c.key)).filter((e): e is ExportCol => !!e);
    const li = cols.findIndex((c) => c.key === 'litres');
    const ai = cols.findIndex((c) => c.key === 'amount');
    return {
      filename: `farmer-collection-${applied.from}-${applied.to}`,
      title: 'Farmer collection',
      subtitle: `${plantName}  |  ${centreName}  |  ${applied.shift === 'both' ? 'Morning & Evening' : applied.shift}  |  ${applied.kind === 'both' ? 'Cow & Buffalo' : applied.kind}  |  ${fmtDate(applied.from)} to ${fmtDate(applied.to)}`,
      columns: cols.map((c) => ({
        header: c.header,
        ...(c.type ? { type: c.type } : {}),
        ...(c.total === 'sum' ? { total: 'sum' as const } : c.total === 'wavg' && li >= 0 ? { total: { wavg: li } } : c.total === 'ratio' && li >= 0 && ai >= 0 ? { total: { ratio: [ai, li] as [number, number] } } : {}),
      })),
      rows: rows.map((r) => cols.map((c) => c.value(r))),
      totals: cols.map((c, i) => (i === 0 ? 'Total' : c.key === 'name' ? `${rows.length} entries` : '')),
    };
  };

  // Bansi login (user id 307) keeps the Total row in both Old and New Excel; every other login gets the plain STIPL sheet (no Total row)
  const bansiUser = BANSI_USER_IDS.includes(String(GLOBALS.userid ?? '').trim());
  const fileScope = applied.centre === 'all' || !applied.centre ? 'All' : applied.centre;
  // Old Excel = Date first layout (22 columns, no Total row), New Excel = Station Id first layout (also no Total row, same as STIPL)
  const baseActions: ExportAction[] = reportActions({
    build: buildTable,
    count: rows.length,
    unit: 'entries',
    toast: toast.show,
    stiplExcel: {
      // Old Excel = farmercollection.xlsx layout, New Excel = 101010.xlsx layout; data only like the STIPL portal (NO Total row), except for the Bansi login which keeps the Total row.
      // File name = VLC ("All" when All is selected) - Old / New - from - to
      old: () => sheetTable(OLD_ORDER, rows, `${fileScope}-Old-${applied.from}-${applied.to}`, 'num2', bansiUser),
      new: () => sheetTable(NEW_ORDER, rows, `${fileScope}-New-${applied.from}-${applied.to}`, 'num2', bansiUser),
    },
  });
  // Bansi login (user id 307) + VLC "All": New Excel Export gives the centre-wise "All" sheet. Everything else (and Old Excel Export) is unchanged.
  const centreNames = new Map(centres.map((c) => [c.id, c.name || c.id]));
  const actions: ExportAction[] = baseActions.map((a) =>
    a.id === 'excel' && isBansiAll(applied.centre)
      ? {
          ...a,
          run: async () => {
            try {
              await exportBansiAllExcel(rows, applied.from, applied.to, (id) => centreNames.get(id) ?? '');
              toast.show(`Exported ${rows.length} entries as New Excel`, 'ok');
            } catch {
              toast.show(MSG.exportFailed, 'error');
            }
          },
        }
      : a,
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Farmer Collection" subtitle="Litres, fat, SNF, rate and amount for every farmer, by plant, centre and shift." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard index={0} tone="brand" label="Total Liter" note="Litres collected" icon={Milk} value={totals.litres} format={(n) => nf(n, 1)} />
        <StatCard index={1} tone="ok" label="Fat" note="Weighted average %" icon={Droplets} value={totals.fat} format={(n) => nf(n, 2)} />
        <StatCard index={2} tone="warn" label="Snf" note="Weighted average %" icon={FlaskConical} value={totals.snf} format={(n) => nf(n, 2)} />
        <StatCard index={3} tone="danger" label="Total Farmer" note="Pouring in this range" icon={Users} value={totals.farmers} format={(n) => nf(Math.round(n))} />
      </div>

      <FarmerCollectionFilters value={{ ...draft, plant: scope.plant, centre: scope.centre }} plantOptions={scope.plantOptions} centreOptions={scope.centreOptions} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} onSubmit={submit} error={error} loading={fetching} />

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
          <ReportLoader label="Loading farmer collection…" done={live.done} total={live.total} />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No collection found" text="Try another date range, shift or milk type." />
        ) : (
          <DataTable columns={columns} rows={pager.visible} rowKey={(r) => r.id} ariaLabel="Farmer collection" minWidth={Math.max(520, shownKeys.size * 73)} />
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

export default FarmerCollection;
