import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { useMilkFarmerEntries, useMilkCenterOptions } from '../../hooks/useMilkReportData';
import { withFormulaTotals } from '../../lib/exporters';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { reportActions } from '../../components/ui/reportActions';
import { PartialNotice } from '../../components/ui/PartialNotice';
import type { ExportTable } from '../../lib/exporters';

import { PageHeader } from '../../components/ui/PageHeader';
import { useReportTable } from '../../hooks/useSessionData';
import { Pagination } from '../../components/ui/Pagination';
import { Panel } from '../../components/ui/Panel';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Toast } from '../../components/ui/Toast';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { fmtDate, nf, toISO } from '../../lib/format';
import { DateRangeFields } from '../../components/ui/DateRangeFields';
import { validateDateRange, validatePastLimit } from '../../lib/dateRange';

/* ---------- Types ---------- */

/** Filter keys = API request params (From Date -> fromDate, To Date -> toDate). */
interface Filters {
  fromDate: string;
  toDate: string;
}

/** One table row = one society (centre) inside a union (plant/route). */
interface UnionRow {
  id: string;
  union: string;
  society: string;
  farmer: number;
  qty: number;
  avgFat: number;
  avgSnf: number;
  avgRate: number;
  amount: number;
}

/* ---------- Filter card ---------- */

interface FilterProps {
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onSubmit: () => void;
  error?: string;
  loading?: boolean;
}

const UnionwiseFilters: React.FC<FilterProps> = ({ value, onChange, onSubmit, error, loading }) => (
  <section aria-label="Unionwise Collection" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
    <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-card">
        <SlidersHorizontal size={17} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold leading-tight">Unionwise Collection</h2>
        <p className="text-xs text-mute">Pick the dates, then press Submit.</p>
      </div>
    </header>

    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-x-4 gap-y-4 p-4 sm:p-5 xl:grid-cols-12"
    >
      <div className="xl:col-span-6">
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

      <div className="flex items-end xl:col-span-6">
        <Button type="submit" size="lg" disabled={loading} icon={<Search size={16} aria-hidden />} className="group h-11 w-full bg-gradient-to-r from-brand to-glow">
          Submit
        </Button>
      </div>
    </form>
  </section>
);

/* ---------- Page ---------- */

const defaults = (): Filters => {
  const today = toISO(new Date());
  return { fromDate: today, toDate: today };
};

const COLUMNS: Column<UnionRow>[] = [
  { key: 'union', header: 'Union', cell: (r) => <span className="font-semibold">{r.union}</span> },
  { key: 'society', header: 'Society', cell: (r) => <span className="font-semibold">{r.society}</span>, mobile: 'title' },
  { key: 'farmer', header: 'Farmer', align: 'right', cell: (r) => <span className="tnum">{nf(r.farmer)}</span> },
  { key: 'qty', header: 'Qty', align: 'right', cell: (r) => <span className="tnum font-semibold">{nf(r.qty, 1)}</span> },
  { key: 'avgFat', header: 'Avg. Fat', align: 'right', cell: (r) => <span className="tnum">{nf(r.avgFat, 2)}</span> },
  { key: 'avgSnf', header: 'Avg. SNF', align: 'right', cell: (r) => <span className="tnum">{nf(r.avgSnf, 2)}</span> },
  { key: 'avgRate', header: 'Avg. Rate', align: 'right', cell: (r) => <span className="tnum">₹{nf(r.avgRate, 2)}</span> },
  { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <span className="tnum font-bold">₹{nf(r.amount, 2)}</span> },
];

const UnionwiseCollection: React.FC = () => {
  const resultsRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Filters>(defaults);
  const [applied, setApplied] = useState<Filters>(defaults);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const toast = useToast();
  const centres = useMilkCenterOptions();
  const live = useMilkFarmerEntries({ from: applied.fromDate, to: applied.toDate, shift: 'both', milk: 'both' }, submitted);
  const fetching = live.fetching;
  const loading = live.loading;
  const rows = useMemo(() => { const groups = new Map<string, typeof live.rows>(); for (const r of live.rows) { const key = `${r.plant}|${r.stationId}`; groups.set(key, [...(groups.get(key) ?? []), r]); } return [...groups].map(([key, list]) => { const first=list[0]; const qty=list.reduce((a,r)=>a+r.litres,0); const amount=list.reduce((a,r)=>a+r.amount,0); return { id:key, union:centres.find((c) => c.mccId === first?.plant)?.plantName || first?.plant || '', society:centres.find((c) => c.id === first?.stationId)?.name || first?.centre || first?.stationId || '', farmer:new Set(list.map((r)=>r.farmerId)).size, qty, avgFat:qty?list.reduce((a,r)=>a+r.fat*r.litres,0)/qty:0, avgSnf:qty?list.reduce((a,r)=>a+r.snf*r.litres,0)/qty:0, avgRate:qty?amount/qty:0, amount }; }); }, [live.rows, centres]);
  const pager = usePagination(rows);

  const submit = () => {
    const rangeError = validateDateRange(draft.fromDate, draft.toDate) ?? validatePastLimit(draft.fromDate);
    if (rangeError) {
      setError(rangeError);
      toast.show(rangeError, 'warn');
      return;
    }
    setError(undefined);
    if (submitted && JSON.stringify(applied) === JSON.stringify(draft)) { live.retry(); }
    setApplied(draft);
    setSubmitted(true);
    // bring the results (and the loader) up so nothing has to be scrolled
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    pager.reset();
  };

  const tbl = useReportTable('unionwisecollection', COLUMNS);
  const buildTable = (): ExportTable => {
    const qty = rows.reduce((a, r) => a + r.qty, 0);
    const amount = rows.reduce((a, r) => a + r.amount, 0);
    return withFormulaTotals({
      filename: `unionwise-collection-${applied.fromDate}-${applied.toDate}`,
      title: 'Unionwise collection',
      subtitle: `${fmtDate(applied.fromDate)} to ${fmtDate(applied.toDate)}`,
      columns: tbl.pick([
        { header: 'Union' }, { header: 'Society' }, { header: 'Farmer', type: 'int' }, { header: 'Qty', type: 'dec1' },
        { header: 'Avg. Fat', type: 'dec2' }, { header: 'Avg. SNF', type: 'dec2' }, { header: 'Avg. Rate', type: 'money' }, { header: 'Amount', type: 'money' },
      ] as ExportTable['columns']),
      rows: rows.map((r) => tbl.pick<string | number>([r.union, r.society, r.farmer, r.qty, r.avgFat, r.avgSnf, r.avgRate, r.amount])),
      totals: tbl.pickTotals(['Total', `${rows.length} societies`, rows.reduce((a, r) => a + r.farmer, 0), Math.round(qty * 10) / 10, '', '', qty ? Math.round((amount / qty) * 100) / 100 : 0, Math.round(amount * 100) / 100]),
    });
  };

  const actions: ExportAction[] = reportActions({ build: buildTable, count: rows.length, unit: 'rows', toast: toast.show, without: ['print', 'csv'] });

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Unionwise Collection" subtitle="Totals by union and society, with average fat, SNF and rate." />

      <UnionwiseFilters value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} onSubmit={submit} error={error} loading={fetching} />

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
          <ReportLoader label="Loading unionwise collection…" done={live.done} total={live.total} />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No collection found" text="Try another date range." />
        ) : (
          <DataTable columns={tbl.columns} rows={pager.visible} rowKey={(r) => r.id} ariaLabel="Unionwise collection" minWidth={820} />
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

export default UnionwiseCollection;
