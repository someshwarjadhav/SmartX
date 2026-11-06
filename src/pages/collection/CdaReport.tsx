import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { useMilkCenterOptions } from '../../hooks/useMilkReportData';
import { GroupedTable, type GroupColumn } from '../../components/ui/GroupedTable';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { reportActions } from '../../components/ui/reportActions';
import { PartialNotice } from '../../components/ui/PartialNotice';
import { Segmented } from '../../components/ui/Segmented';
import { Field, SelectField } from '../../components/ui/Fields';
import { DateRangeFields } from '../../components/ui/DateRangeFields';
import { KindChip } from '../../components/ui/KindChip';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { Toast } from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/cn';
import { fmtDate, nf, toISO } from '../../lib/format';
import { validateDateRange, validatePastLimit } from '../../lib/dateRange';
import type { ExportTable } from '../../lib/exporters';
import { KIND_OPTIONS, SHIFT_OPTIONS, type Shift } from '../../data/masters';
import type { MilkKind } from '../../types';
import { getCdaReport, CDA_ALL_SHIFT_CODE, type CdaRaw, type CdaSide } from '../../services/report/cdaReport.api';

/* ---------- Types ---------- */

type ShiftPick = Shift | 'both';
type MilkPick = MilkKind | 'both';

interface Filters {
  vlcId: string;
  fromDate: string;
  toDate: string;
  shift: ShiftPick;
  milk: MilkPick;
}

interface Metrics {
  weight: number;
  fat: number;
  snf: number;
  kgFat: number;
  kgSnf: number;
  rate: number;
  amount: number;
}

interface CdaRow {
  id: string;
  vlccId: string;
  vlcc: string;
  type: 'Cow' | 'Buffalo' | 'Mix' | 'Both';
  composite: Metrics;
  dispatch: Metrics;
  actual: Metrics;
}

type Diff = Pick<Metrics, 'weight' | 'fat' | 'snf' | 'rate' | 'amount'>;

const r2 = (n: number): number => Math.round(n * 100) / 100;

/* ---------- Numbers ---------- */

const EMPTY: Metrics = { weight: 0, fat: 0, snf: 0, kgFat: 0, kgSnf: 0, rate: 0, amount: 0 };

/** Days / shifts added up: litres and amount are summed, fat / SNF / rate are averages weighted by litres. */
function metricsOf(items: CdaRaw[], pick: (r: CdaRaw) => CdaSide): Metrics {
  let qty = 0, kgFat = 0, kgSnf = 0, amount = 0, rateQty = 0;
  for (const r of items) {
    const s = pick(r);
    qty += s.qty;
    kgFat += (s.qty * s.fat) / 100;
    kgSnf += (s.qty * s.snf) / 100;
    amount += s.amount;
    rateQty += s.qty * s.rate;
  }
  if (!qty) return { ...EMPTY, amount: r2(amount) };
  return {
    weight: r2(qty),
    fat: r2((kgFat / qty) * 100),
    snf: r2((kgSnf / qty) * 100),
    kgFat: r2(kgFat),
    kgSnf: r2(kgSnf),
    // the server sends the rate when it has one, otherwise it is amount / litres
    rate: r2(rateQty > 0 ? rateQty / qty : amount / qty),
    amount: r2(amount),
  };
}

const delta = (a: Metrics, b: Metrics): Diff => ({
  weight: r2(a.weight - b.weight),
  fat: r2(a.fat - b.fat),
  snf: r2(a.snf - b.snf),
  rate: r2(a.rate - b.rate),
  amount: r2(a.amount - b.amount),
});

const rowOf = (vlccId: string, vlcc: string, type: CdaRow['type'], items: CdaRaw[]): CdaRow => ({
  id: `${vlccId}|${type}`,
  vlccId,
  vlcc,
  type,
  composite: metricsOf(items, (r) => r.v),
  dispatch: metricsOf(items, (r) => r.d),
  actual: metricsOf(items, (r) => r.f),
});

/* ---------- Table ---------- */

const tone = (n: number): string => (n > 0 ? 'text-ok' : n < 0 ? 'text-danger' : '');
const both = (r: CdaRow): string | undefined => (r.type === 'Both' ? 'bg-soft/60 font-semibold' : undefined);

const SET: Array<[keyof Metrics, string]> = [
  ['weight', 'Weight'], ['fat', 'Fat'], ['snf', 'SNF'], ['kgFat', 'Kg Fat'], ['kgSnf', 'Kg SNF'], ['rate', 'Rate'], ['amount', 'Amount'],
];
const DIFF_SET: Array<[keyof Diff, string]> = [['weight', 'Weight'], ['fat', 'Fat'], ['snf', 'SNF'], ['rate', 'Rate'], ['amount', 'Amount']];

const setCols = (prefix: string, pick: (r: CdaRow) => Metrics): GroupColumn<CdaRow>[] =>
  SET.map(([k, label]) => ({
    key: `${prefix}-${k}`,
    header: label,
    align: 'right' as const,
    className: both,
    cell: (r: CdaRow) => <span className={cn('tnum', k === 'amount' && 'font-semibold')}>{nf(pick(r)[k], 2)}</span>,
  }));

const diffCols = (prefix: string, pick: (r: CdaRow) => Diff): GroupColumn<CdaRow>[] =>
  DIFF_SET.map(([k, label]) => ({
    key: `${prefix}-${k}`,
    header: label,
    align: 'right' as const,
    className: both,
    cell: (r: CdaRow) => <span className={cn('tnum', k === 'amount' && 'font-semibold', tone(pick(r)[k]))}>{nf(pick(r)[k], 2)}</span>,
  }));

const compositeActual = (r: CdaRow): Diff => delta(r.composite, r.actual);
const dispatchActual = (r: CdaRow): Diff => delta(r.dispatch, r.actual);
const compositeDispatch = (r: CdaRow): Diff => delta(r.composite, r.dispatch);

const COLUMNS: GroupColumn<CdaRow>[] = [
  {
    key: 'vlcc',
    header: 'VLCC',
    group: (r) => r.vlccId,
    cell: (r) => <span className="font-semibold">{r.vlcc}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    className: both,
    cell: (r) => (r.type === 'Both' ? <span className="font-semibold">Both</span> : <KindChip kind={r.type === 'Cow' ? 'cow' : r.type === 'Buffalo' ? 'buffalo' : 'mix'} />),
  },
  ...setCols('c', (r) => r.composite),
  ...setCols('d', (r) => r.dispatch),
  ...setCols('a', (r) => r.actual),
  ...diffCols('ca', compositeActual),
  ...diffCols('da', dispatchActual),
  ...diffCols('cd', compositeDispatch),
];

const HEADER_GROUPS = [
  { label: '', span: 2 },
  { label: 'Composite', span: 7 },
  { label: 'Dispatch', span: 7 },
  { label: 'Actual', span: 7 },
  { label: 'Composite − Actual', span: 5 },
  { label: 'Dispatch − Actual', span: 5 },
  { label: 'Composite − Dispatch', span: 5 },
];

/* ---------- Filter card ---------- */

interface FilterProps {
  value: Filters;
  vlcOptions: { value: string; label: string }[];
  onChange: (patch: Partial<Filters>) => void;
  onSubmit: () => void;
  error?: string;
  loading?: boolean;
}

const KIND_FILTER_OPTIONS: { value: MilkPick; label: string }[] = [...KIND_OPTIONS, { value: 'both', label: 'Both' }];
const SHIFT_FILTER_OPTIONS: { value: ShiftPick; label: string }[] = [...SHIFT_OPTIONS, { value: 'both', label: 'Both' }];
const SEGMENT = 'w-full [&>button]:h-9 [&>button]:flex-1';

const CdaFilters: React.FC<FilterProps> = ({ value, vlcOptions, onChange, onSubmit, error, loading }) => (
  <section aria-label="CDA Report" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
    <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-card">
        <SlidersHorizontal size={17} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold leading-tight">CDA Report</h2>
        <p className="text-xs text-mute">Pick the VLC, milk type, shift and dates, then press Show.</p>
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
      <SelectField wrapperClassName="xl:col-span-4" label="VLC Name" value={value.vlcId} onChange={(vlcId) => onChange({ vlcId })} options={vlcOptions} />
      <Field label="Milk Type" className="xl:col-span-4">
        <Segmented<MilkPick> label="Milk Type" value={value.milk} onChange={(milk) => onChange({ milk })} options={KIND_FILTER_OPTIONS} className={SEGMENT} />
      </Field>
      <Field label="Shift" className="xl:col-span-4">
        <Segmented<ShiftPick> label="Shift" value={value.shift} onChange={(shift) => onChange({ shift })} options={SHIFT_FILTER_OPTIONS} className={SEGMENT} />
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

      <div className="flex items-end sm:col-span-2 xl:col-span-6">
        <Button type="submit" size="lg" disabled={loading} loading={loading} icon={<Search size={16} aria-hidden />} className="h-11 w-full bg-gradient-to-r from-brand to-glow">
          Show
        </Button>
      </div>
    </form>
  </section>
);

/* ---------- Page ---------- */

const defaults = (): Filters => {
  const today = toISO(new Date());
  return { vlcId: '', fromDate: today, toDate: today, shift: 'both', milk: 'both' };
};

/** Runs the calls a few at a time, so a long VLC list never opens dozens of requests together. */
async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane));
}

const CdaReport: React.FC = () => {
  const resultsRef = useRef<HTMLDivElement>(null);
  const runId = useRef(0);
  const centres = useMilkCenterOptions();
  const toast = useToast();

  const [draft, setDraft] = useState<Filters>(defaults);
  const [applied, setApplied] = useState<Filters>(defaults);
  const [submitted, setSubmitted] = useState(false);
  const [raw, setRaw] = useState<CdaRaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState({ failed: 0, total: 0 });
  const [error, setError] = useState<string | undefined>();

  const vlcOptions = useMemo(() => centres.map((c) => ({ value: c.id, label: c.label })), [centres]);
  const labelOf = useMemo(() => new Map(centres.map((c) => [c.id, c.label])), [centres]);
  const nameOf = (id: string): string => {
    const l = labelOf.get(id);
    // "Shri Sheelavanti | 500002" -> "500002 - Shri Sheelavanti"
    if (!l || l === id) return id;
    const name = l.split(' | ')[0] ?? l;
    return `${id} - ${name}`;
  };

  // nothing picked yet (or a centre of another login) = the first centre of the list
  const shownVlc = vlcOptions.some((o) => o.value === draft.vlcId) ? draft.vlcId : vlcOptions[0]?.value ?? '';

  const load = async (f: Filters) => {
    const id = ++runId.current;
    setLoading(true);
    setRaw([]);
    const milks: Array<'C' | 'B' | 'M'> = f.milk === 'cow' ? ['C'] : f.milk === 'buffalo' ? ['B'] : f.milk === 'mix' ? ['M'] : ['C', 'B', 'M'];
    // "Both" shifts: one call when the server knows an "all shifts" code, otherwise Morning and Evening separately
    const shifts: string[] =
      f.shift === 'Morning' ? ['M']
      : f.shift === 'Evening' ? ['E']
      : CDA_ALL_SHIFT_CODE ? [CDA_ALL_SHIFT_CODE]
      : ['M', 'E'];
    const tasks = [f.vlcId].flatMap((vlccId) => milks.flatMap((milk) => shifts.map((shift) => ({ vlccId, milk, shift }))));
    const got: CdaRaw[] = [];
    let bad = 0;
    let firstError = '';
    await pool(tasks, 4, async (t) => {
      try {
        got.push(...(await getCdaReport({ from: f.fromDate, to: f.toDate, ...t })));
      } catch (e) {
        // "Both" also asks for mix milk; a centre without mix milk may answer with an error, which is not a problem
        if (t.milk === 'M' && f.milk === 'both') return;
        bad += 1;
        firstError ||= e instanceof Error ? e.message : 'The CDA report could not be loaded.';
      }
    });
    if (id !== runId.current) return; // a newer Show was pressed meanwhile
    setRaw(got);
    setFailed({ failed: bad, total: tasks.length });
    setError(bad === tasks.length && tasks.length > 0 ? firstError : undefined);
    setLoading(false);
  };

  const rows = useMemo<CdaRow[]>(() => {
    const out: CdaRow[] = [];
    for (const vlccId of [applied.vlcId]) {
      const mine = raw.filter((r) => r.vlccId === vlccId);
      if (!mine.length) continue;
      const vlcc = nameOf(vlccId);
      const cow = mine.filter((r) => r.milk === 'C');
      const buf = mine.filter((r) => r.milk === 'B');
      const mix = mine.filter((r) => r.milk === 'M');
      if (applied.milk === 'cow' || applied.milk === 'both') out.push(rowOf(vlccId, vlcc, 'Cow', cow));
      if (applied.milk === 'buffalo' || applied.milk === 'both') out.push(rowOf(vlccId, vlcc, 'Buffalo', buf));
      // mix milk gets its own row only when there is some
      if (applied.milk === 'mix' || (applied.milk === 'both' && mix.length)) out.push(rowOf(vlccId, vlcc, 'Mix', mix));
      if (applied.milk === 'both') out.push(rowOf(vlccId, vlcc, 'Both', mine));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, applied, labelOf]);

  const submit = () => {
    const rangeError = validateDateRange(draft.fromDate, draft.toDate) ?? validatePastLimit(draft.fromDate);
    if (rangeError) {
      setError(rangeError);
      toast.show(rangeError, 'warn');
      return;
    }
    if (!shownVlc) {
      setError('No VLC is available for this login.');
      toast.show('No VLC is available for this login.', 'warn');
      return;
    }
    setError(undefined);
    const next: Filters = { ...draft, vlcId: shownVlc };
    setApplied(next);
    setSubmitted(true);
    void load(next);
    // bring the results (and the loader) up so nothing has to be scrolled
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const buildTable = (): ExportTable => {
    const cols = (names: string[]) => names.map((header) => ({ header, type: 'dec2' as const }));
    const metric = SET.map(([, l]) => l);
    const diff = DIFF_SET.map(([, l]) => l);
    const metrics = (m: Metrics) => SET.map(([k]) => m[k]);
    const diffs = (d: Diff) => DIFF_SET.map(([k]) => d[k]);
    return {
      filename: `cda-report-${applied.fromDate}-${applied.toDate}`,
      title: 'CDA report',
      subtitle: `${labelOf.get(applied.vlcId) ?? applied.vlcId}  |  ${fmtDate(applied.fromDate)} to ${fmtDate(applied.toDate)}`,
      headerGroups: HEADER_GROUPS,
      columns: [{ header: 'VLCC' }, { header: 'Type' }, ...cols(metric), ...cols(metric), ...cols(metric), ...cols(diff), ...cols(diff), ...cols(diff)],
      rows: rows.map((r) => [
        r.vlcc, r.type,
        ...metrics(r.composite), ...metrics(r.dispatch), ...metrics(r.actual),
        ...diffs(compositeActual(r)), ...diffs(dispatchActual(r)), ...diffs(compositeDispatch(r)),
      ]),
      merge: [{ col: 0, by: [0] }],
    };
  };

  const actions: ExportAction[] = reportActions({ build: buildTable, count: rows.length, unit: 'rows', toast: toast.show, without: ['print'] });

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="CDA Report"  />

      <CdaFilters value={{ ...draft, vlcId: shownVlc }} vlcOptions={vlcOptions} onChange={(patch) => setDraft((d) => ({ ...d, vlcId: shownVlc, ...patch }))} onSubmit={submit} error={submitted ? undefined : error} loading={loading} />

      {error && submitted && !loading && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error} <button type="button" className="ml-2 underline" onClick={() => void load(applied)}>Retry</button>
        </div>
      )}
      <PartialNotice failed={error ? 0 : failed.failed} total={failed.total} onRetry={() => void load(applied)} />

      <div ref={resultsRef} className="scroll-mt-20">
        <Panel bodyClassName="!p-0">
          {!submitted ? (
            <EmptyState icon={SlidersHorizontal} title="Set your filters first" text="Choose the options above and press Show to load the data." />
          ) : loading ? (
            <ReportLoader label="Loading CDA report…" />
          ) : rows.length === 0 ? (
            <EmptyState icon={SearchX} title="No data found" text="No CDA record for this VLC and these dates." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <p className="text-sm text-mute">
                  <span className="tnum font-semibold text-ink">{rows.length}</span> rows · {fmtDate(applied.fromDate)} to {fmtDate(applied.toDate)}
                </p>
                <ExportBar actions={actions} disabled={loading || rows.length === 0} />
              </div>
              <GroupedTable columns={COLUMNS} rows={rows} rowKey={(r) => r.id} ariaLabel="CDA report" headerGroups={HEADER_GROUPS} minWidth={2300} />
            </>
          )}
        </Panel>
      </div>

      <Toast message={toast.message} onClose={toast.close} />
    </div>
  );
};

export default CdaReport;