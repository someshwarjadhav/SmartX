import type * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, FileSpreadsheet, FileText, Search, SearchX, SlidersHorizontal, Table2 } from 'lucide-react';
import { useMilkFarmerEntries, useMilkVlccEntries, useMilkCenterOptions } from '../../hooks/useMilkReportData';
import type { Shift } from '../../data/masters';
import type { MilkKind } from '../../types';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { SelectField, TextField } from '../../components/ui/Fields';
import { KindChip } from '../../components/ui/KindChip';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { Panel } from '../../components/ui/Panel';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Toast } from '../../components/ui/Toast';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { exportCSV, exportExcel, exportPDF, type ExportTable } from '../../lib/exporters';
import { cn } from '../../lib/cn';
import { fmtDate, nf, toISO } from '../../lib/format';

/* ---------- Types ---------- */

/** Filter keys = API request params (VLC Name -> vlcId, From Date -> fromDate, To Date -> toDate). */
interface Filters {
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

const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;

/* ---------- Filter card ---------- */

interface FilterProps {
  value: Filters;
  vlcOptions: { value: string; label: string }[];
  onChange: (patch: Partial<Filters>) => void;
  onSubmit: () => void;
  error?: string;
  loading?: boolean;
}

const VarianceFilters: React.FC<FilterProps> = ({ value, vlcOptions, onChange, onSubmit, error, loading }) => (
  <section aria-label="Variance Report" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
    <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-card">
        <SlidersHorizontal size={17} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold leading-tight">Variance Report</h2>
        <p className="text-xs text-mute">Pick the VLC and dates, then press Submit.</p>
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
      <SelectField wrapperClassName="xl:col-span-5" label="VLC Name" value={value.vlcId} onChange={(vlcId) => onChange({ vlcId })} options={vlcOptions} />

      <div className="grid grid-cols-1 items-start gap-2 min-[480px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:col-span-2 xl:col-span-7">
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

/* ---------- Table ---------- */

const TH = 'whitespace-nowrap border border-line px-3 py-2.5 text-xs font-semibold text-mute';
const GROUP = 'whitespace-nowrap border border-line bg-brand/[0.06] px-3 py-2.5 text-center text-xs font-bold text-brand';
const TD = 'tnum whitespace-nowrap border border-line px-3 py-2.5 text-right';
const TOTAL = 'tnum border border-line bg-soft/60 px-3 py-2.5 text-center text-xs font-semibold leading-relaxed';

const sum = (rows: VarianceRow[], pick: (r: VarianceRow) => number): number => rows.reduce((a, r) => a + pick(r), 0);
const ofKind = (rows: VarianceRow[], kind: MilkKind): VarianceRow[] => rows.filter((r) => r.milkType === kind);

const diffTone = (n: number): string => (n > 0 ? 'text-ok' : n < 0 ? 'text-danger' : '');

const VarianceTable: React.FC<{ rows: VarianceRow[]; all: VarianceRow[]; loading: boolean }> = ({ rows, all, loading }) => {
  const cow = ofKind(all, 'cow');
  const buf = ofKind(all, 'buffalo');

  const lit = (pick: (r: VarianceRow) => number) => ({
    c: nf(sum(cow, pick), 1),
    b: nf(sum(buf, pick), 1),
    t: nf(sum(all, pick), 1),
  });
  const amt = (pick: (r: VarianceRow) => number) => ({
    c: nf(sum(cow, pick), 2),
    b: nf(sum(buf, pick), 2),
    t: nf(sum(all, pick), 2),
  });

  const vendorL = lit((r) => r.vendorQty);
  const vendorA = amt((r) => r.vendorAmount);
  const farmerL = lit((r) => r.farmerQty);
  const farmerA = amt((r) => r.farmerAmount);
  const diffL = lit((r) => r.qtyDiff);
  const diffA = amt((r) => r.amountDiff);

  if (loading) {
    return (
      <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="skeleton block h-5 w-full rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="scroll-x">
      <table aria-label="Variance report" className="w-full border-collapse text-sm" style={{ minWidth: 1500 }}>
        <thead>
          <tr>
            <th colSpan={5} className={TH} />
            <th colSpan={5} className={GROUP}>DOC Collection</th>
            <th colSpan={5} className={GROUP}>VLC Collection</th>
            <th colSpan={4} className={GROUP}>Difference</th>
          </tr>
          <tr className="bg-soft/40">
            {['VLCC Id', 'Village Name', 'Date', 'Shift', 'Milk Type', 'Vendor Qty', 'Vendor Fat', 'Vendor SNF', 'Vendor Rate', 'Vendor Amount', 'Farmer Qty', 'Farmer Fat', 'Farmer SNF', 'Farmer Rate', 'Farmer Amount', 'Qty Diff', 'Fat Diff', 'SNF Diff', 'Amount Diff'].map((h) => (
              <th key={h} scope="col" className={cn(TH, 'text-left')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-brand/5">
              <td className="tnum whitespace-nowrap border border-line px-3 py-2.5"><span className="rounded-md bg-soft px-2 py-0.5 text-xs font-semibold">{r.vlccId}</span></td>
              <td className="whitespace-nowrap border border-line px-3 py-2.5 font-semibold">{r.village}</td>
              <td className="tnum whitespace-nowrap border border-line px-3 py-2.5">{fmtDate(r.date)}</td>
              <td className="whitespace-nowrap border border-line px-3 py-2.5">{r.shift}</td>
              <td className="whitespace-nowrap border border-line px-3 py-2.5"><KindChip kind={r.milkType} /></td>
              <td className={TD}>{nf(r.vendorQty, 1)}</td>
              <td className={TD}>{nf(r.vendorFat, 1)}</td>
              <td className={TD}>{nf(r.vendorSnf, 1)}</td>
              <td className={TD}>₹{nf(r.vendorRate, 2)}</td>
              <td className={cn(TD, 'font-semibold')}>₹{nf(r.vendorAmount, 2)}</td>
              <td className={TD}>{nf(r.farmerQty, 1)}</td>
              <td className={TD}>{nf(r.farmerFat, 1)}</td>
              <td className={TD}>{nf(r.farmerSnf, 1)}</td>
              <td className={TD}>₹{nf(r.farmerRate, 2)}</td>
              <td className={cn(TD, 'font-semibold')}>₹{nf(r.farmerAmount, 2)}</td>
              <td className={cn(TD, diffTone(r.qtyDiff))}>{nf(r.qtyDiff, 1)}</td>
              <td className={cn(TD, diffTone(r.fatDiff))}>{nf(r.fatDiff, 1)}</td>
              <td className={cn(TD, diffTone(r.snfDiff))}>{nf(r.snfDiff, 1)}</td>
              <td className={cn(TD, 'font-semibold', diffTone(r.amountDiff))}>₹{nf(r.amountDiff, 2)}</td>
            </tr>
          ))}
        </tbody>
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
      </table>
    </div>
  );
};

/* ---------- Page ---------- */

const defaults = (): Filters => {
  const today = toISO(new Date());
  return { vlcId: 'all', fromDate: today, toDate: today };
};

const VarianceReport: React.FC = () => {
  const centres = useMilkCenterOptions();
  const vlcOptions = useMemo(() => [{ value: 'all', label: 'All' }, ...centres.map((c) => ({ value: c.id, label: c.label }))], [centres]);
  const [draft, setDraft] = useState<Filters>(defaults);
  const [applied, setApplied] = useState<Filters>(defaults);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const toast = useToast();
  const vendor = useMilkVlccEntries({ from: applied.fromDate, to: applied.toDate, shift: 'both', milk: 'both', vlccId: applied.vlcId }, submitted);
  const farmer = useMilkFarmerEntries({ from: applied.fromDate, to: applied.toDate, shift: 'both', milk: 'both', vlccId: applied.vlcId }, submitted);
  const loading = vendor.loading || farmer.loading;
  const rows = useMemo(() => {
    type Agg={id:string;vlccId:string;village:string;date:string;shift:Shift;milkType:MilkKind;qty:number;fat:number;snf:number;amount:number};
    const agg = (items:Array<{vlccid:string;village:string;date:string;shift:Shift;milk:MilkKind;liter:number;fat:number;snf:number;rate:number;amount:number}>) => { const m=new Map<string,typeof items>(); for(const r of items){const k=`${r.vlccid}|${r.date}|${r.shift}|${r.milk}`;m.set(k,[...(m.get(k)??[]),r]);} const out=new Map<string,Agg>(); for(const [id,list] of m){const f=list[0];if(!f)continue;const qty=list.reduce((a,r)=>a+r.liter,0);out.set(id,{id,vlccId:f.vlccid,village:f.village,date:f.date,shift:f.shift,milkType:f.milk,qty,fat:qty?list.reduce((a,r)=>a+r.fat*r.liter,0)/qty:0,snf:qty?list.reduce((a,r)=>a+r.snf*r.liter,0)/qty:0,amount:list.reduce((a,r)=>a+r.amount,0)});}return out;};
    const farmerItems=farmer.rows.map(r=>({vlccid:r.stationId,village:r.centre,date:r.date,shift:r.shift,milk:r.kind,liter:r.litres,fat:r.fat,snf:r.snf,rate:r.rate,amount:r.amount})); const v=agg(vendor.rows), f=agg(farmerItems); const keys=new Set([...v.keys(),...f.keys()]); const out:VarianceRow[]=[];
    for(const key of keys){const vr=v.get(key),fr=f.get(key),base=fr??vr;if(!base)continue;const vQty=vr?.qty??0,fQty=fr?.qty??0,vAmt=vr?.amount??0,fAmt=fr?.amount??0;out.push({id:key,vlccId:base.vlccId,village:base.village,date:base.date,shift:base.shift,milkType:base.milkType,vendorQty:r1(vQty),vendorFat:r1(vr?.fat??0),vendorSnf:r1(vr?.snf??0),vendorRate:vQty?r2(vAmt/vQty):0,vendorAmount:r2(vAmt),farmerQty:r1(fQty),farmerFat:r1(fr?.fat??0),farmerSnf:r1(fr?.snf??0),farmerRate:fQty?r2(fAmt/fQty):0,farmerAmount:r2(fAmt),qtyDiff:r1(vQty-fQty),fatDiff:r1((vr?.fat??0)-(fr?.fat??0)),snfDiff:r1((vr?.snf??0)-(fr?.snf??0)),amountDiff:r2(vAmt-fAmt)});}
    return out.sort((a,b)=>b.date.localeCompare(a.date)||a.vlccId.localeCompare(b.vlccId)||a.shift.localeCompare(b.shift));
  }, [vendor.rows, farmer.rows]);
  const pager = usePagination(rows);

  const submit = () => {
    if (draft.fromDate > draft.toDate) {
      setError('From date cannot be after To date');
      return;
    }
    setError(undefined);
    if (submitted && JSON.stringify(applied) === JSON.stringify(draft)) { vendor.retry(); farmer.retry(); }
    setApplied(draft);
    setSubmitted(true);
    pager.reset();
  };

  const buildTable = (): ExportTable => ({
    filename: `variance-report-${applied.fromDate}-${applied.toDate}`,
    title: 'Variance report',
    subtitle: `${fmtDate(applied.fromDate)} to ${fmtDate(applied.toDate)}`,
    columns: [
      { header: 'VLCC Id' }, { header: 'Village Name' }, { header: 'Date' }, { header: 'Shift' }, { header: 'Milk Type' },
      { header: 'Vendor Qty', type: 'dec1' }, { header: 'Vendor Fat', type: 'dec1' }, { header: 'Vendor SNF', type: 'dec1' }, { header: 'Vendor Rate', type: 'money' }, { header: 'Vendor Amount', type: 'money' },
      { header: 'Farmer Qty', type: 'dec1' }, { header: 'Farmer Fat', type: 'dec1' }, { header: 'Farmer SNF', type: 'dec1' }, { header: 'Farmer Rate', type: 'money' }, { header: 'Farmer Amount', type: 'money' },
      { header: 'Qty Diff', type: 'dec1' }, { header: 'Fat Diff', type: 'dec1' }, { header: 'SNF Diff', type: 'dec1' }, { header: 'Amount Diff', type: 'money' },
    ],
    rows: rows.map((r) => [r.vlccId, r.village, fmtDate(r.date), r.shift, r.milkType, r.vendorQty, r.vendorFat, r.vendorSnf, r.vendorRate, r.vendorAmount, r.farmerQty, r.farmerFat, r.farmerSnf, r.farmerRate, r.farmerAmount, r.qtyDiff, r.fatDiff, r.snfDiff, r.amountDiff]),
    totals: ['Total', '', '', '', '', r1(sum(rows, (r) => r.vendorQty)), '', '', '', r2(sum(rows, (r) => r.vendorAmount)), r1(sum(rows, (r) => r.farmerQty)), '', '', '', r2(sum(rows, (r) => r.farmerAmount)), r1(sum(rows, (r) => r.qtyDiff)), '', '', r2(sum(rows, (r) => r.amountDiff))],
  });

  const exportAs = (label: string, run: (t: ExportTable) => void | Promise<void>) => async () => {
    try {
      await run(buildTable());
      toast.show(`Exported ${rows.length} rows as ${label}`);
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
      <PageHeader title="Variance Report" subtitle="Centre collection against plant receipt. Difference = Vendor − Farmer." />

      <VarianceFilters value={draft} vlcOptions={vlcOptions} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} onSubmit={submit} error={error} loading={loading} />

      {(vendor.error || farmer.error) && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{vendor.error || farmer.error} <button className="ml-2 underline" onClick={() => { vendor.retry(); farmer.retry(); }}>Retry</button></div>}

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
          <ReportLoader label="Loading variance report…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No variance found" text="Try another VLC or date range." />
        ) : (
          <VarianceTable rows={pager.visible} all={rows} loading={loading} />
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

export default VarianceReport;
