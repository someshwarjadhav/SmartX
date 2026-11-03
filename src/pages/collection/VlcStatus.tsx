import type * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Search, SlidersHorizontal, Wifi, WifiOff } from 'lucide-react';
import { useMilkVlccEntries, useMilkCenterOptions, usePlantOptions } from '../../hooks/useMilkReportData';
import { SHIFT_OPTIONS, type Shift } from '../../data/masters';
import { Badge } from '../../components/ui/Badge';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field, SelectField, TextField } from '../../components/ui/Fields';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { Segmented } from '../../components/ui/Segmented';
import { cn } from '../../lib/cn';
import { nf, toISO } from '../../lib/format';

/* ---------- Types ---------- */

type ShiftFilter = Shift | 'both';

const SHIFT_FILTER_OPTIONS: { value: ShiftFilter; label: string }[] = [...SHIFT_OPTIONS, { value: 'both', label: 'Both' }];

/** Filter keys = API request params (Plant/MCC Name -> plant, Shift -> shift, From/To Date). */
interface Filters {
  plant: string;
  shift: ShiftFilter;
  fromDate: string;
  toDate: string;
}

/** One tile = one VLC. */
interface VlcTile {
  id: string;
  name: string;
  active: boolean;
  lit: number;
  fat: number;
  snf: number;
}

/* ---------- Data source (dummy) ---------- */


/* ---------- Filter card ---------- */

interface FilterProps {
  value: Filters;
  plantOptions: { value: string; label: string }[];
  onChange: (patch: Partial<Filters>) => void;
  onSubmit: () => void;
  error?: string;
  loading?: boolean;
}

const SEGMENT = 'w-full [&>button]:h-9 [&>button]:flex-1';

const VlcStatusFilters: React.FC<FilterProps> = ({ value, plantOptions, onChange, onSubmit, error, loading }) => (
  <section aria-label="MCC/VLC Info" className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
    <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand/10 via-brand/[0.03] to-transparent px-4 py-3.5 sm:px-5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-card">
        <SlidersHorizontal size={17} aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-base font-semibold leading-tight">MCC/VLC Info</h2>
        <p className="text-xs text-mute">Pick the plant, shift and dates, then press Submit.</p>
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
      <SelectField wrapperClassName="xl:col-span-4" label="Plant/MCC Name" value={value.plant} onChange={(plant) => onChange({ plant })} options={plantOptions} />
      <Field label="Shift" className="xl:col-span-4">
        <Segmented<ShiftFilter> label="Shift" value={value.shift} onChange={(shift) => onChange({ shift })} options={SHIFT_FILTER_OPTIONS} className={SEGMENT} />
      </Field>

      <div className="grid grid-cols-1 items-start gap-2 min-[480px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:col-span-2 xl:col-span-12">
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

/* ---------- Page ---------- */

const defaults = (): Filters => {
  const today = toISO(new Date());
  return { plant: 'all', shift: 'both', fromDate: today, toDate: today };
};

const Tile: React.FC<{ tile: VlcTile }> = ({ tile }) => (
  <li
    className={cn(
      'flex flex-col items-center rounded-xl border p-4 text-center transition hover:-translate-y-0.5 hover:shadow-card',
      tile.active ? 'border-ok/30 bg-ok/[0.06]' : 'border-danger/25 bg-danger/[0.04]',
    )}
  >
    <p className="font-display text-sm font-bold uppercase tracking-wide">{tile.name}</p>
    <p className="tnum text-sm font-semibold text-mute">{tile.id}</p>
    <span className={cn('my-3 grid h-11 w-11 place-items-center rounded-xl', tile.active ? 'bg-ok/15 text-ok' : 'bg-danger/12 text-danger')}>
      {tile.active ? <Wifi size={22} aria-label="Active" /> : <WifiOff size={22} aria-label="Inactive" />}
    </span>
    <dl className="tnum space-y-0.5 text-xs font-semibold">
      <div>Lit : {nf(tile.lit, 2)}</div>
      <div>Fat : {nf(tile.fat, 2)}</div>
      <div>SNF : {nf(tile.snf, 2)}</div>
    </dl>
  </li>
);

const VlcStatus: React.FC = () => {
  const centres = useMilkCenterOptions();
  const plantOptions = usePlantOptions(centres);
  const [draft, setDraft] = useState<Filters>(defaults);
  const [applied, setApplied] = useState<Filters>(defaults);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const live = useMilkVlccEntries({ from: applied.fromDate, to: applied.toDate, shift: applied.shift, milk: 'both' }, submitted);
  const loading = live.loading;
  const tiles = useMemo(() => centres.filter((c) => applied.plant === 'all' || c.mccId === applied.plant).map((c) => { const list = live.rows.filter((r) => r.vlccid === c.id && (applied.shift === 'both' || r.shift === applied.shift)); const lit = list.reduce((a,r)=>a+r.liter,0); return { id:c.id, name:c.name || c.id, active:list.length>0, lit, fat:lit?list.reduce((a,r)=>a+r.fat*r.liter,0)/lit:0, snf:lit?list.reduce((a,r)=>a+r.snf*r.liter,0)/lit:0 }; }), [centres, live.rows, applied]);
  const active = tiles.filter((t) => t.active).length;

  const submit = () => {
    if (draft.fromDate > draft.toDate) {
      setError('From date cannot be after To date');
      return;
    }
    setError(undefined);
    if (submitted && JSON.stringify(applied) === JSON.stringify(draft)) { live.retry(); }
    setApplied(draft);
    setSubmitted(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="VLC Status" subtitle="Which centres are online and reporting." />

      <VlcStatusFilters value={draft} plantOptions={plantOptions} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} onSubmit={submit} error={error} loading={loading} />

      {live.error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{live.error} <button className="ml-2 underline" onClick={live.retry}>Retry</button></div>}

      <Panel
        title="VLC Active/In Active"
        action={
          submitted && !loading && (
          <div className="flex items-center gap-2">
            <Badge tone="ok">Active {active}</Badge>
            <Badge tone="danger">Inactive {tiles.length - active}</Badge>
          </div>
          )
        }
      >
        {!submitted ? (
          <EmptyState icon={SlidersHorizontal} title="Set your filters first" text="Choose the options above and press Submit to load the data." />
        ) : loading ? (
          <ReportLoader label="Loading VLC status…" />
        ) : tiles.length === 0 ? (
          <EmptyState icon={WifiOff} title="No VLC found" text="This plant has no VLC yet." />
        ) : (
          <ul className={'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'}>
            {tiles.map((t) => (
              <Tile key={t.id} tile={t} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default VlcStatus;
