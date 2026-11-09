import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { centreIdsFor, useMilkCenterOptions, useReportScope } from '../../hooks/useMilkReportData';
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
import { Pagination } from '../../components/ui/Pagination';
import { Panel } from '../../components/ui/Panel';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Toast } from '../../components/ui/Toast';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/cn';
import { fmtDate, nf, toISO } from '../../lib/format';
import { validateDateRange, validatePastLimit } from '../../lib/dateRange';
import { exportExcel, type ExportColumn, type ExportTable } from '../../assets/excel/exporters';
import { MSG } from '../../lib/messages';
import { KIND_OPTIONS, SHIFT_OPTIONS, type Shift } from '../../data/masters';
import type { MilkKind } from '../../types';
import { getCdaReport, CDA_ALL_SHIFT_CODE, type CdaRaw, type CdaSide } from '../../services/report/cdaReport.api';

/* ---------- Types ---------- */

type ShiftPick = Shift | 'both';
type MilkPick = MilkKind | 'both';

interface Filters {
  plant: string;
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
  /** the centre's number in front of its id: "1. 500381" (station code, else its place in the centre list) */
  serial: number;
  vlccId: string;
  vlcc: string;
  type: 'Cow' | 'Buffalo' | 'Mix';
  /** the picked date range (every row covers all of it) */
  from: string;
  to: string;
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

/**
 * Differences exactly as the client's "VLC Difference Report" sheet shows them:
 *   Composite-Actual = Actual - Composite, Dispatch-Actual = Actual - Dispatch, Composite-Dispatch = Dispatch - Composite
 */
const delta = (from: Metrics, to: Metrics): Diff => ({
  weight: r2(to.weight - from.weight),
  fat: r2(to.fat - from.fat),
  snf: r2(to.snf - from.snf),
  rate: r2(to.rate - from.rate),
  amount: r2(to.amount - from.amount),
});

const isEmpty = (m: Metrics): boolean => !m.weight && !m.fat && !m.snf && !m.kgFat && !m.kgSnf && !m.rate && !m.amount;

const MILK_NAME: Record<'C' | 'B' | 'M', CdaRow['type']> = { C: 'Cow', B: 'Buffalo', M: 'Mix' };

/* ---------- Table ---------- */

const tone = (n: number): string => (n > 0 ? 'text-ok' : n < 0 ? 'text-danger' : '');

const SET: Array<[keyof Metrics, string]> = [
  ['weight', 'Weight'], ['fat', 'Fat'], ['snf', 'SNF'], ['kgFat', 'Kg Fat'], ['kgSnf', 'Kg SNF'], ['rate', 'Rate'], ['amount', 'Amount'],
];
const DIFF_SET: Array<[keyof Diff, string]> = [['weight', 'Weight'], ['fat', 'Fat'], ['snf', 'SNF'], ['rate', 'Rate'], ['amount', 'Amount']];

const compositeActual = (r: Pick<CdaRow, 'composite' | 'actual'>): Diff => delta(r.composite, r.actual);
const dispatchActual = (r: Pick<CdaRow, 'dispatch' | 'actual'>): Diff => delta(r.dispatch, r.actual);
const compositeDispatch = (r: Pick<CdaRow, 'composite' | 'dispatch'>): Diff => delta(r.composite, r.dispatch);

/** what the last row of the sheet shows: all the rows added up */
interface CdaTotal {
  type: string;
  composite: Metrics;
  dispatch: Metrics;
  actual: Metrics;
}

/** fixed widths (px) - names end with "..." (hover shows the whole name) so the long table does not stretch */
const W = { id: 92, name: 190, type: 70, date: 92, metric: 78, amount: 96 };

const setCols = (prefix: string, pick: (r: CdaRow) => Metrics): GroupColumn<CdaRow>[] =>
  SET.map(([k, label]) => ({
    key: `${prefix}-${k}`,
    header: label,
    align: 'right' as const,
    width: k === 'amount' ? W.amount : W.metric,
    cell: (r: CdaRow) => <span className={cn('tnum', k === 'amount' && 'font-semibold')}>{nf(pick(r)[k], 2)}</span>,
  }));

const diffCols = (prefix: string, pick: (r: CdaRow) => Diff): GroupColumn<CdaRow>[] =>
  DIFF_SET.map(([k, label]) => ({
    key: `${prefix}-${k}`,
    header: label,
    align: 'right' as const,
    width: k === 'amount' ? W.amount : W.metric,
    cell: (r: CdaRow) => <span className={cn('tnum', k === 'amount' && 'font-semibold', tone(pick(r)[k]))}>{nf(pick(r)[k], 2)}</span>,
  }));

const COLUMNS: GroupColumn<CdaRow>[] = [
  { key: 'vlcId', header: 'VLC ID', width: W.id, cell: (r) => <span className="tnum font-semibold">{r.serial}. {r.vlccId}</span> },
  { key: 'vlcName', header: 'VLC Name', width: W.name, cell: (r) => <span className="block truncate font-semibold" title={r.vlcc}>{r.vlcc}</span> },
  {
    key: 'type',
    header: 'Type',
    width: W.type,
    cell: (r) => <KindChip kind={r.type === 'Cow' ? 'cow' : r.type === 'Buffalo' ? 'buffalo' : 'mix'} />,
  },
  { key: 'from', header: 'From Date', width: W.date, cell: (r) => <span className="tnum">{r.from}</span> },
  { key: 'to', header: 'To Date', width: W.date, cell: (r) => <span className="tnum">{r.to}</span> },
  ...setCols('c', (r) => r.composite),
  ...setCols('d', (r) => r.dispatch),
  ...setCols('a', (r) => r.actual),
  ...diffCols('ca', compositeActual),
  ...diffCols('da', dispatchActual),
  ...diffCols('cd', compositeDispatch),
];

const HEADER_GROUPS = [
  { label: '', span: 5 },
  { label: 'Composite', span: 7 },
  { label: 'Dispatch', span: 7 },
  { label: 'Actual', span: 7 },
  { label: 'Composite-Actual', span: 5 },
  { label: 'Dispatch-Actual', span: 5 },
  { label: 'Composite-Dispatch', span: 5 },
];

const TOTAL_CELL = 'border border-line px-2.5 py-2.5 text-right font-bold tnum whitespace-nowrap';

/** the bold last row of the table: Total / All selected VLCs / type / dates / every column added up */
const TotalFooter: React.FC<{ total: CdaTotal; from: string; to: string }> = ({ total, from, to }) => {
  const m = (x: Metrics) => SET.map(([k]) => x[k]);
  const d = (x: Diff) => DIFF_SET.map(([k]) => x[k]);
  const values = [
    ...m(total.composite), ...m(total.dispatch), ...m(total.actual),
    ...d(compositeActual(total)), ...d(dispatchActual(total)), ...d(compositeDispatch(total)),
  ];
  const diffFrom = SET.length * 3;
  return (
    <tfoot>
      <tr className="bg-brand/15 font-bold">
        <td className="border border-line border-t-2 border-t-ink/40 px-2.5 py-2.5 font-bold">Total</td>
        <td className="border border-line border-t-2 border-t-ink/40 px-2.5 py-2.5 font-bold">All selected VLCs</td>
        <td className="border border-line border-t-2 border-t-ink/40 px-2.5 py-2.5 font-bold">{total.type}</td>
        <td className="tnum border border-line border-t-2 border-t-ink/40 px-2.5 py-2.5 font-bold">{from}</td>
        <td className="tnum border border-line border-t-2 border-t-ink/40 px-2.5 py-2.5 font-bold">{to}</td>
        {values.map((v, i) => (
          <td key={i} className={cn(TOTAL_CELL, 'border-t-2 border-t-ink/40', i >= diffFrom && tone(v))}>{nf(v, 2)}</td>
        ))}
      </tr>
    </tfoot>
  );
};

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

const KIND_FILTER_OPTIONS: { value: MilkPick; label: string }[] = [...KIND_OPTIONS, { value: 'both', label: 'Both' }];
const SHIFT_FILTER_OPTIONS: { value: ShiftPick; label: string }[] = [...SHIFT_OPTIONS, { value: 'both', label: 'Both' }];
const SEGMENT = 'w-full [&>button]:h-9 [&>button]:flex-1';

const CdaFilters: React.FC<FilterProps> = ({ value, plantOptions, vlcOptions, onChange, onSubmit, error, loading }) => (
  <section aria-label="CDA Report" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
    <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-card">
        <SlidersHorizontal size={17} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold leading-tight">CDA Report</h2>
        <p className="text-xs text-mute">Pick the plant, VLC, milk type, shift and dates, then press Show.</p>
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
      <Field label="Milk Type" className="xl:col-span-3">
        <Segmented<MilkPick> label="Milk Type" value={value.milk} onChange={(milk) => onChange({ milk })} options={KIND_FILTER_OPTIONS} className={SEGMENT} />
      </Field>
      <Field label="Shift" className="xl:col-span-3">
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
  return { plant: '', vlcId: '', fromDate: today, toDate: today, shift: 'both', milk: 'both' };
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

  // Plant/MCC -> VLC dropdowns: real plants / centres plus an "All" row; the first real plant and centre are selected by default
  const scope = useReportScope(centres, draft.plant, draft.vlcId, true);
  /** the centres a run covers: one VLC, or (All) every centre of the picked plant / of every plant */
  const idsOf = (f: Filters): string[] => centreIdsFor(centres, f.plant, f.vlcId);
  const labelOf = useMemo(() => new Map(centres.map((c) => [c.id, c.label])), [centres]);
  const shownVlc = scope.centre;

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
    const tasks = idsOf(f).flatMap((vlccId) => milks.flatMap((milk) => shifts.map((shift) => ({ vlccId, milk, shift }))));
    const got: CdaRaw[] = [];
    let bad = 0;
    let firstError = '';
    await pool(tasks, 6, async (t) => {
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

  /** the centres in the order of their id: the number in front of an id ("1. 500381") is the centre's station code, else its place here */
  const orderedIds = (f: Filters): string[] => [...idsOf(f)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const serialOf = (id: string, place: number): number => {
    const code = centres.find((c) => c.id === id)?.code?.trim() ?? '';
    const n = /^\d+$/.test(code) && code !== id ? Number(code) : NaN;
    return Number.isFinite(n) && n > 0 && n < 10000 ? n : place;
  };

  /** one row for every VLC and milk type that has a record, the whole date range added up (From Date / To Date columns) */
  const rows = useMemo<CdaRow[]>(() => {
    const out: CdaRow[] = [];
    const kinds: Array<'C' | 'B' | 'M'> = applied.milk === 'cow' ? ['C'] : applied.milk === 'buffalo' ? ['B'] : applied.milk === 'mix' ? ['M'] : ['C', 'B', 'M'];
    orderedIds(applied).forEach((vlccId, i) => {
      const mine = raw.filter((r) => r.vlccId === vlccId);
      if (!mine.length) return;
      const vlcc = (labelOf.get(vlccId) ?? '').split(' | ')[0] || vlccId;
      for (const k of kinds) {
        const items = mine.filter((r) => r.milk === k);
        if (!items.length) continue;
        const composite = metricsOf(items, (r) => r.v);
        const dispatch = metricsOf(items, (r) => r.d);
        const actual = metricsOf(items, (r) => r.f);
        if (isEmpty(composite) && isEmpty(dispatch) && isEmpty(actual)) continue;
        out.push({ id: `${vlccId}|${k}`, serial: serialOf(vlccId, i + 1), vlccId, vlcc, type: MILK_NAME[k], from: applied.fromDate, to: applied.toDate, composite, dispatch, actual });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, applied, labelOf, centres]);

  /** the Total row: the rows above added up (weight, Kg and amount are sums; fat / SNF / rate are averages weighted by weight) - the same numbers the Excel Total row formulas give */
  const total = useMemo<CdaTotal>(() => {
    const sum = (pick: (r: CdaRow) => Metrics): Metrics => {
      const ms = rows.map(pick);
      const weight = ms.reduce((a, x) => a + x.weight, 0);
      const avg = (f: (x: Metrics) => number): number => (weight ? ms.reduce((a, x) => a + x.weight * f(x), 0) / weight : 0);
      return {
        weight: r2(weight),
        fat: r2(avg((x) => x.fat)),
        snf: r2(avg((x) => x.snf)),
        kgFat: r2(ms.reduce((a, x) => a + x.kgFat, 0)),
        kgSnf: r2(ms.reduce((a, x) => a + x.kgSnf, 0)),
        rate: r2(avg((x) => x.rate)),
        amount: r2(ms.reduce((a, x) => a + x.amount, 0)),
      };
    };
    return {
      type: [...new Set(rows.map((r) => r.type))].join(' + '),
      composite: sum((r) => r.composite),
      dispatch: sum((r) => r.dispatch),
      actual: sum((r) => r.actual),
    };
  }, [rows]);

  const pager = usePagination(rows);

  const submit = () => {
    const rangeError = validateDateRange(draft.fromDate, draft.toDate) ?? validatePastLimit(draft.fromDate);
    if (rangeError) {
      setError(rangeError);
      toast.show(rangeError, 'warn');
      return;
    }
    if (!shownVlc || !idsOf({ ...draft, plant: scope.plant, vlcId: shownVlc }).length) {
      setError('No VLC is available for this login.');
      toast.show('No VLC is available for this login.', 'warn');
      return;
    }
    setError(undefined);
    const next: Filters = { ...draft, plant: scope.plant, vlcId: shownVlc };
    setApplied(next);
    setSubmitted(true);
    pager.reset();
    void load(next);
    // bring the results (and the loader) up so nothing has to be scrolled
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  /**
   * Excel Export = the client's "VLC Difference Report" sheet: header on row 1, ONE row for every VLC and milk type
   * (VLC ID "1. 500381", VLC Name, Type, From Date, To Date, Composite x7, Dispatch x7, Actual x7, then the three differences x5 = 41 columns)
   * and a bold Total row at the end ("Total" / "All selected VLCs") with real Excel formulas.
   */
  const buildExcelTable = (): ExportTable => {
    const columns: ExportColumn[] = [{ header: 'VLC ID' }, { header: 'VLC Name' }, { header: 'Type' }, { header: 'From Date' }, { header: 'To Date' }];
    // Composite / Dispatch / Actual: 7 columns each, starting at column 5, 12 and 19
    (['Composite', 'Dispatch', 'Actual'] as const).forEach((group, g) => {
      const w = 5 + g * 7;
      columns.push(
        { header: `${group} Weight`, type: 'dec2', total: 'sum' },
        { header: `${group} Fat`, type: 'dec2', total: { wavg: w } },
        { header: `${group} SNF`, type: 'dec2', total: { wavg: w } },
        { header: `${group} Kg Fat`, type: 'dec2', total: 'sum' },
        { header: `${group} Kg SNF`, type: 'dec2', total: 'sum' },
        { header: `${group} Rate`, type: 'dec2', total: { wavg: w } },
        { header: `${group} Amount`, type: 'dec2', total: 'sum' },
      );
    });
    // differences: 5 columns each (Weight, Fat, SNF, Rate, Amount). Their Total = the second group's total minus the first group's total.
    const OFFSET = [0, 1, 2, 5, 6]; // position of Weight, Fat, SNF, Rate, Amount inside a 7-column group
    const GROUP_AT = { Composite: 5, Dispatch: 12, Actual: 19 } as const;
    const DIFFS: Array<[string, keyof typeof GROUP_AT, keyof typeof GROUP_AT]> = [
      ['Composite-Actual', 'Composite', 'Actual'],
      ['Dispatch-Actual', 'Dispatch', 'Actual'],
      ['Composite-Dispatch', 'Composite', 'Dispatch'],
    ];
    for (const [label, a, b] of DIFFS) {
      DIFF_SET.forEach(([, name], j) => {
        columns.push({ header: `${label} ${name}`, type: 'dec2', total: { diff: [GROUP_AT[b] + OFFSET[j]!, GROUP_AT[a] + OFFSET[j]!] } });
      });
    }

    const m = (x: Metrics) => SET.map(([k]) => x[k]);
    const d = (x: Diff) => DIFF_SET.map(([k]) => x[k]);
    const tableRows = rows.map((r) => [
      `${r.serial}. ${r.vlccId}`, r.vlcc, r.type, applied.fromDate, applied.toDate,
      ...m(r.composite), ...m(r.dispatch), ...m(r.actual),
      ...d(compositeActual(r)), ...d(dispatchActual(r)), ...d(compositeDispatch(r)),
    ]);
    const dates = applied.fromDate === applied.toDate ? fmtDate(applied.fromDate) : `${fmtDate(applied.fromDate)} to ${fmtDate(applied.toDate)}`;
    return {
      filename: `CDA Report ${dates}`,
      title: 'VLC Difference Report',
      columns,
      rows: tableRows,
      totals: ['Total', 'All selected VLCs', total.type, applied.fromDate, applied.toDate],
    };
  };

  const excelRows = rows.length;
  // PDF Export and CSV Export are switched off (commented out) on this report for now.
  // To show them again: use the first line below and delete the second one.
  // const base: ExportAction[] = reportActions({ build: buildExcelTable, count: rows.length, unit: 'rows', toast: toast.show, without: ['print'] });
  const base: ExportAction[] = reportActions({ build: buildExcelTable, count: rows.length, unit: 'rows', toast: toast.show, without: ['print', 'pdf', 'csv'] });
  const actions: ExportAction[] = base.map((a) =>
    a.id === 'excel'
      ? {
          ...a,
          run: async () => {
            try {
              await exportExcel(buildExcelTable());
              toast.show(`Exported ${excelRows} rows as Excel`, 'ok');
            } catch {
              toast.show(MSG.exportFailed, 'error');
            }
          },
        }
      : a,
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="CDA Report"  />

      <CdaFilters value={{ ...draft, plant: scope.plant, vlcId: shownVlc }} plantOptions={scope.plantOptions} vlcOptions={scope.centreOptions} onChange={(patch) => setDraft((d) => ({ ...d, plant: scope.plant, vlcId: shownVlc, ...patch }))} onSubmit={submit} error={submitted ? undefined : error} loading={loading} />

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
                <ReportLoader label="Loading CDA report…" />
              ) : rows.length === 0 ? (
                <EmptyState icon={SearchX} title="No data found" text="No CDA record for this VLC and these dates." />
              ) : (
                <GroupedTable columns={COLUMNS} rows={pager.visible} rowKey={(r) => r.id} ariaLabel="CDA report" headerGroups={HEADER_GROUPS} minWidth={COLUMNS.reduce((a, c) => a + (c.width ?? 90), 0)} footer={<TotalFooter total={total} from={applied.fromDate} to={applied.toDate} />} />
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

export default CdaReport;