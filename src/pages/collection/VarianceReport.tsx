import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Search, SlidersHorizontal } from 'lucide-react';
import { useMilkFarmerEntries, useMilkVlccEntries, useMilkCenterOptions, useReportScope } from '../../hooks/useMilkReportData';
import { GroupedTable, type GroupColumn } from '../../components/ui/GroupedTable';
import type { Shift } from '../../data/masters';
import type { MilkKind } from '../../types';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchX } from 'lucide-react';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { reportActions } from '../../components/ui/reportActions';
import { PartialNotice } from '../../components/ui/PartialNotice';
import type { ExportTable } from '../../lib/exporters';
import { SelectField, TextField } from '../../components/ui/Fields';
import { KindChip } from '../../components/ui/KindChip';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { Panel } from '../../components/ui/Panel';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Toast } from '../../components/ui/Toast';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/cn';
import { fmtDate, fmtDateLong, nf, toISO } from '../../lib/format';

/* ---------- Types ---------- */

/** Filter keys = API request params (VLC Name -> vlcId, From Date -> fromDate, To Date -> toDate). */
interface Filters {
  plant: string;
  vlcId: string;
  fromDate: string;
  toDate: string;
}

/** One table row = one VLC, one date, one shift, one milk type. */
interface VarianceRow {
  id: string;
  vlccId: string;
  village: string;
  date: string;
  shift: Shift;
  milkType: MilkKind;
  vendorQty: number;
  vendorFat: number;
  vendorSnf: number;
  vendorRate: number;
  vendorAmount: number;
  farmerQty: number;
  farmerFat: number;
  farmerSnf: number;
  farmerRate: number;
  farmerAmount: number;
  qtyDiff: number;
  fatDiff: number;
  snfDiff: number;
  amountDiff: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/* ---------- Filter card ---------- */

interface FilterProps {
  value: Filters;
  plantOptions: { value: string; label: string }[];
  vlcOptions: { value: string; label: string }[];
  onChange: (patch: Partial<Filters>) => void;
  onSubmit: () => void;
  error?: string;
  loading?: boolean;
}

const VarianceFilters: React.FC<FilterProps> = ({ value, plantOptions, vlcOptions, onChange, onSubmit, error, loading }) => (
  <section aria-label="Variance Report" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
    <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-card">
        <SlidersHorizontal size={17} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold leading-tight">Variance Report</h2>
        <p className="text-xs text-mute">Pick the plant, VLC and dates, then press Submit.</p>
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
      <SelectField wrapperClassName="xl:col-span-3" label="Plant/MCC Name" value={value.plant} onChange={(plant) => onChange({ plant, vlcId: '' })} options={plantOptions} />
      <SelectField wrapperClassName="xl:col-span-3" label="VLC Name" value={value.vlcId} onChange={(vlcId) => onChange({ vlcId })} options={vlcOptions} />

      <div className="grid grid-cols-1 items-start gap-2 min-[480px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:col-span-2 xl:col-span-6">
        <TextField label="From Date" type="date" icon={<CalendarDays size={16} />} value={value.fromDate} max={value.toDate || undefined} onChange={(e) => onChange({ fromDate: e.target.value })} />
        <ArrowRight size={16} className="mt-[2.4rem] hidden text-mute min-[480px]:block" aria-hidden />
        <TextField label="To Date" type="date" icon={<CalendarDays size={16} />} value={value.toDate} min={value.fromDate || undefined} onChange={(e) => onChange({ toDate: e.target.value })} error={error} />
      </div>

      <div className="sm:col-span-2 xl:col-span-12">
        <Button type="submit" size="lg" disabled={loading} icon={<Search size={16} aria-hidden />} className="group h-11 w-full bg-gradient-to-r from-brand to-glow">
          Submit
        </Button>
      </div>
    </form>
  </section>
);

/* ---------- Table (STIPL layout: merged VLCC / Date / Milk Type cells) ---------- */

const TOTAL = 'tnum border border-line bg-soft/60 px-3 py-2.5 text-center text-xs font-semibold leading-relaxed';

const sum = (rows: VarianceRow[], pick: (r: VarianceRow) => number): number => rows.reduce((a, r) => a + pick(r), 0);
const ofKind = (rows: VarianceRow[], kind: MilkKind): VarianceRow[] => rows.filter((r) => r.milkType === kind);
const diffTone = (n: number): string => (n > 0 ? 'text-ok' : n < 0 ? 'text-danger' : '');

/** Group keys are cumulative: Date inside VLCC, Milk Type inside Date (one merged cell per run). */
const vlccKey = (r: VarianceRow): string => r.vlccId;
const dateKey = (r: VarianceRow): string => `${r.vlccId}|${r.date}`;
const milkKey = (r: VarianceRow): string => `${r.vlccId}|${r.date}|${r.milkType}`;

const num = (pick: (r: VarianceRow) => number, d = 2) => (r: VarianceRow) => <span className="tnum">{nf(pick(r), d)}</span>;
const diff = (pick: (r: VarianceRow) => number, d = 2, bold = false) => (r: VarianceRow) => <span className={cn('tnum', bold && 'font-semibold', diffTone(pick(r)))}>{nf(pick(r), d)}</span>;

const COLUMNS: GroupColumn<VarianceRow>[] = [
  { key: 'vlccId', header: 'VLCC Id', group: vlccKey, cell: (r) => <span className="tnum rounded-md bg-soft px-2 py-0.5 text-xs font-semibold">{r.vlccId}</span> },
  { key: 'village', header: 'Village Name', group: vlccKey, cell: (r) => r.village },
  { key: 'date', header: 'Date', group: dateKey, cell: (r) => <span className="tnum">{fmtDateLong(r.date)}</span> },
  { key: 'shift', header: 'Shift', cell: (r) => r.shift },
  { key: 'milkType', header: 'Milk Type', group: milkKey, cell: (r) => <KindChip kind={r.milkType} /> },
  { key: 'vendorQty', header: 'Vendor Qty', align: 'right', cell: num((r) => r.vendorQty) },
  { key: 'vendorFat', header: 'Vendor Fat', align: 'right', cell: num((r) => r.vendorFat) },
  { key: 'vendorSnf', header: 'Vendor SNF', align: 'right', cell: num((r) => r.vendorSnf) },
  { key: 'vendorRate', header: 'Vendor Rate', align: 'right', cell: num((r) => r.vendorRate) },
  { key: 'vendorAmount', header: 'Vendor Amount', align: 'right', cell: (r) => <span className="tnum font-semibold">{nf(r.vendorAmount, 2)}</span> },
  { key: 'farmerQty', header: 'Farmer Qty', align: 'right', cell: num((r) => r.farmerQty) },
  { key: 'farmerFat', header: 'Farmer Fat', align: 'right', cell: num((r) => r.farmerFat) },
  { key: 'farmerSnf', header: 'Farmer SNF', align: 'right', cell: num((r) => r.farmerSnf) },
  { key: 'farmerRate', header: 'Farmer Rate', align: 'right', cell: num((r) => r.farmerRate) },
  { key: 'farmerAmount', header: 'Farmer Amount', align: 'right', cell: (r) => <span className="tnum font-semibold">{nf(r.farmerAmount, 2)}</span> },
  { key: 'qtyDiff', header: 'Qty Diff', align: 'right', cell: diff((r) => r.qtyDiff) },
  { key: 'fatDiff', header: 'Fat Diff', align: 'right', cell: diff((r) => r.fatDiff) },
  { key: 'snfDiff', header: 'SNF Diff', align: 'right', cell: diff((r) => r.snfDiff) },
  { key: 'amountDiff', header: 'Amount Diff', align: 'right', cell: diff((r) => r.amountDiff, 2, true) },
];

const HEADER_GROUPS = [
  { label: '', span: 5 },
  { label: 'DOC Collection', span: 5 },
  { label: 'VLC Collection', span: 5 },
  { label: 'Difference', span: 4 },
];

const VarianceFooter: React.FC<{ all: VarianceRow[] }> = ({ all }) => {
  const cow = ofKind(all, 'cow');
  const buf = ofKind(all, 'buffalo');
  const lit = (pick: (r: VarianceRow) => number) => ({ c: nf(sum(cow, pick), 1), b: nf(sum(buf, pick), 1), t: nf(sum(all, pick), 1) });
  const amt = (pick: (r: VarianceRow) => number) => ({ c: nf(sum(cow, pick), 2), b: nf(sum(buf, pick), 2), t: nf(sum(all, pick), 2) });
  const vendorL = lit((r) => r.vendorQty);
  const vendorA = amt((r) => r.vendorAmount);
  const farmerL = lit((r) => r.farmerQty);
  const farmerA = amt((r) => r.farmerAmount);
  const diffL = lit((r) => r.qtyDiff);
  const diffA = amt((r) => r.amountDiff);
  return (
    <tfoot>
      <tr>
        <td className="border border-line" />
        <td className="border border-line px-3 py-2.5 text-center text-xs font-bold">Total :</td>
        <td colSpan={3} className="border border-line" />
        <td colSpan={3} className={TOTAL}>C Lit : {vendorL.c}<br />Amt : {vendorA.c}<br />Tot Lit : {vendorL.t}</td>
        <td colSpan={2} className={TOTAL}>B Lit : {vendorL.b}<br />Amt : {vendorA.b}<br />Tot Amt : {vendorA.t}</td>
        <td colSpan={3} className={TOTAL}>C Lit : {farmerL.c}<br />Amt : {farmerA.c}<br />Tot Lit : {farmerL.t}</td>
        <td colSpan={2} className={TOTAL}>B Lit : {farmerL.b}<br />Amt : {farmerA.b}<br />Tot Amt : {farmerA.t}</td>
        <td colSpan={2} className={TOTAL}>C Diff : {diffL.c}<br />Amt : {diffA.c}<br />Tot Lit : {diffL.t}</td>
        <td colSpan={2} className={TOTAL}>B Diff : {diffL.b}<br />Amt : {diffA.b}<br />Tot Amt : {diffA.t}</td>
      </tr>
    </tfoot>
  );
};

/* ---------- Page ---------- */

const defaults = (): Filters => {
  const today = toISO(new Date());
  // plant / VLC '' = first plant and its first centre (no "All" row)
  return { plant: '', vlcId: '', fromDate: today, toDate: today };
};

const KIND_ORDER: Record<string, number> = { cow: 0, buffalo: 1, mix: 2 };
const KIND_TEXT: Record<string, string> = { cow: 'Cow', buffalo: 'Buffalo', mix: 'Mix' };

type Agg = { id: string; vlccId: string; village: string; date: string; shift: Shift; milkType: MilkKind; qty: number; fat: number; snf: number; amount: number };
type Src = { vlccid: string; village: string; date: string; shift: Shift; milk: MilkKind; liter: number; fat: number; snf: number; amount: number };

/** one entry per VLC + date + shift + milk type: litres and amount added up, fat / snf weighted by litres */
const aggregate = (items: Src[]): Map<string, Agg> => {
  const groups = new Map<string, Src[]>();
  for (const r of items) {
    const k = `${r.vlccid}|${r.date}|${r.shift}|${r.milk}`;
    const list = groups.get(k);
    if (list) list.push(r);
    else groups.set(k, [r]);
  }
  const out = new Map<string, Agg>();
  for (const [id, list] of groups) {
    const f = list[0];
    if (!f) continue;
    const qty = list.reduce((a, r) => a + r.liter, 0);
    out.set(id, {
      id, vlccId: f.vlccid, village: f.village, date: f.date, shift: f.shift, milkType: f.milk, qty,
      fat: qty ? list.reduce((a, r) => a + r.fat * r.liter, 0) / qty : 0,
      snf: qty ? list.reduce((a, r) => a + r.snf * r.liter, 0) / qty : 0,
      amount: list.reduce((a, r) => a + r.amount, 0),
    });
  }
  return out;
};

const VarianceReport: React.FC = () => {
  const resultsRef = useRef<HTMLDivElement>(null);
  const centres = useMilkCenterOptions();
  const [draft, setDraft] = useState<Filters>(defaults);
  const [applied, setApplied] = useState<Filters>(defaults);
  const scope = useReportScope(centres, draft.plant, draft.vlcId);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const toast = useToast();
  const on = submitted && !!applied.vlcId;
  const vendor = useMilkVlccEntries({ from: applied.fromDate, to: applied.toDate, shift: 'both', milk: 'both', vlccId: applied.vlcId || 'all' }, on);
  const farmer = useMilkFarmerEntries({ from: applied.fromDate, to: applied.toDate, shift: 'both', milk: 'both', vlccId: applied.vlcId || 'all' }, on);
  const fetching = vendor.fetching || farmer.fetching;

  const rows = useMemo(() => {
    const farmerItems: Src[] = farmer.rows.map((r) => ({ vlccid: r.stationId, village: r.centre, date: r.date, shift: r.shift, milk: r.kind, liter: r.litres, fat: r.fat, snf: r.snf, amount: r.amount }));
    const v = aggregate(vendor.rows);
    const f = aggregate(farmerItems);
    const out: VarianceRow[] = [];
    for (const key of new Set([...v.keys(), ...f.keys()])) {
      const vr = v.get(key);
      const fr = f.get(key);
      const base = fr ?? vr;
      if (!base) continue;
      const vQty = vr?.qty ?? 0;
      const fQty = fr?.qty ?? 0;
      const vAmt = vr?.amount ?? 0;
      const fAmt = fr?.amount ?? 0;
      out.push({
        id: key, vlccId: base.vlccId, village: base.village, date: base.date, shift: base.shift, milkType: base.milkType,
        vendorQty: r2(vQty), vendorFat: r2(vr?.fat ?? 0), vendorSnf: r2(vr?.snf ?? 0), vendorRate: vQty ? r2(vAmt / vQty) : 0, vendorAmount: r2(vAmt),
        farmerQty: r2(fQty), farmerFat: r2(fr?.fat ?? 0), farmerSnf: r2(fr?.snf ?? 0), farmerRate: fQty ? r2(fAmt / fQty) : 0, farmerAmount: r2(fAmt),
        qtyDiff: r2(vQty - fQty), fatDiff: r2((vr?.fat ?? 0) - (fr?.fat ?? 0)), snfDiff: r2((vr?.snf ?? 0) - (fr?.snf ?? 0)), amountDiff: r2(vAmt - fAmt),
      });
    }
    // STIPL order: VLCC -> Date (oldest first) -> Milk Type (cow, buffalo) -> Shift (morning, evening), so equal values sit together and merge
    return out.sort((a, b) =>
      a.vlccId.localeCompare(b.vlccId) || a.date.localeCompare(b.date) ||
      (KIND_ORDER[a.milkType] ?? 9) - (KIND_ORDER[b.milkType] ?? 9) ||
      (a.shift === b.shift ? 0 : a.shift === 'Morning' ? -1 : 1));
  }, [vendor.rows, farmer.rows]);
  const pager = usePagination(rows);
  const loading = fetching && rows.length === 0;

  const submit = () => {
    if (draft.fromDate > draft.toDate) {
      setError('From date cannot be after To date');
      return;
    }
    if (!scope.centre) {
      setError('No VLC found for this plant');
      return;
    }
    setError(undefined);
    const next = { ...draft, plant: scope.plant, vlcId: scope.centre };
    if (submitted && JSON.stringify(applied) === JSON.stringify(next)) { vendor.retry(); farmer.retry(); }
    setApplied(next);
    setSubmitted(true);
    // bring the results (and the loader) up so nothing has to be scrolled
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    pager.reset();
  };

  /**
   * Excel / PDF: same two-level header as the screen. VLCC Id + Village merge over the centre, Date over its rows,
   * Milk Type over its shifts. The Total row is made of formulas (SUM, weighted fat / SNF, amount / qty, differences).
   */
  const buildTable = (): ExportTable => ({
    filename: `variance-report-${applied.fromDate}-${applied.toDate}`,
    title: 'Variance report',
    subtitle: `${centres.find((c) => c.id === applied.vlcId)?.label ?? ''}  |  ${fmtDate(applied.fromDate)} to ${fmtDate(applied.toDate)}`,
    headerGroups: HEADER_GROUPS,
    columns: [
      { header: 'VLCC Id' }, { header: 'Village Name' }, { header: 'Date' }, { header: 'Shift' }, { header: 'Milk Type' },
      { header: 'Vendor Qty', type: 'dec2', total: 'sum' }, { header: 'Vendor Fat', type: 'dec2', total: { wavg: 5 } }, { header: 'Vendor SNF', type: 'dec2', total: { wavg: 5 } }, { header: 'Vendor Rate', type: 'dec2', total: { ratio: [9, 5] } }, { header: 'Vendor Amount', type: 'dec2', total: 'sum' },
      { header: 'Farmer Qty', type: 'dec2', total: 'sum' }, { header: 'Farmer Fat', type: 'dec2', total: { wavg: 10 } }, { header: 'Farmer SNF', type: 'dec2', total: { wavg: 10 } }, { header: 'Farmer Rate', type: 'dec2', total: { ratio: [14, 10] } }, { header: 'Farmer Amount', type: 'dec2', total: 'sum' },
      { header: 'Qty Diff', type: 'dec2', total: 'sum' }, { header: 'Fat Diff', type: 'dec2', total: { diff: [6, 11] } }, { header: 'SNF Diff', type: 'dec2', total: { diff: [7, 12] } }, { header: 'Amount Diff', type: 'dec2', total: 'sum' },
    ],
    rows: rows.map((r) => [r.vlccId, r.village, fmtDateLong(r.date), r.shift, KIND_TEXT[r.milkType] ?? r.milkType, r.vendorQty, r.vendorFat, r.vendorSnf, r.vendorRate, r.vendorAmount, r.farmerQty, r.farmerFat, r.farmerSnf, r.farmerRate, r.farmerAmount, r.qtyDiff, r.fatDiff, r.snfDiff, r.amountDiff]),
    totals: ['Total', ...new Array<string>(18).fill('')],
    merge: [
      { col: 0, by: [0] },
      { col: 1, by: [0] },
      { col: 2, by: [0, 2] },
      { col: 4, by: [0, 2, 4] },
    ],
  });

  const actions: ExportAction[] = reportActions({ build: buildTable, count: rows.length, unit: 'rows', toast: toast.show, without: ['print'] });
  const retry = () => { vendor.retry(); farmer.retry(); };

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Variance Report" subtitle="Centre collection against plant receipt. Difference = Vendor − Farmer." />

      <VarianceFilters value={{ ...draft, plant: scope.plant, vlcId: scope.centre }} plantOptions={scope.plantOptions} vlcOptions={scope.centreOptions} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} onSubmit={submit} error={error} loading={fetching} />

      {(vendor.error || farmer.error) && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{vendor.error || farmer.error} <button className="ml-2 underline" onClick={retry}>Retry</button></div>}
      <PartialNotice failed={vendor.failed + farmer.failed} total={vendor.total + farmer.total} onRetry={retry} />

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
          <ReportLoader label="Loading variance report…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No variance found" text="No collection found for this VLC and date range." />
        ) : (
          <GroupedTable columns={COLUMNS} rows={pager.visible} rowKey={(r) => r.id} ariaLabel="Variance report" headerGroups={HEADER_GROUPS} footer={<VarianceFooter all={rows} />} minWidth={1500} />
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

export default VarianceReport;
