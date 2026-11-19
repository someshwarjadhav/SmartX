import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Archive,
  CalendarClock,
  Check,
  CircleAlert,
  Clock3,
  Crown,
  DatabaseBackup,
  HardDrive,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCentreOptions } from '../../hooks/useCentres';
import { useToast } from '../../hooks/useToast';
import { Toast } from '../../components/ui/Toast';
import { Checkbox } from '../../components/ui/Checkbox';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { fmtDate, nf, toISO } from '../../lib/format';
import { PREMIUM_PLAN, fyLabel } from '../../config/premium';
import {
  clearPreference,
  cutoffDate,
  daysUntil,
  deletionDate,
  loadPreference,
  quoteFor,
  retentionYears,
  savePreference,
  type PremiumPreference,
} from '../../services/premium/premium.api';

const inr = (v: number): string => `₹${nf(v)}`;

/* ---------- small pieces ---------- */

const Tile: React.FC<{
  icon: React.ReactNode;
  tone: 'gold' | 'brand' | 'warn';
  title: string;
  price: string;
  unit: string;
  text: string;
  badge?: string;
}> = ({ icon, tone, title, price, unit, text, badge }) => (
  <div className="relative flex flex-col rounded-2xl border border-line bg-panel p-4 shadow-card sm:p-5">
    {badge && (
      <span className="absolute right-4 top-4 rounded-full bg-warn/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-warn">
        {badge}
      </span>
    )}
    <span
      className={cn(
        'grid h-11 w-11 place-items-center rounded-xl',
        tone === 'gold' && 'bg-warn/15 text-warn',
        tone === 'brand' && 'bg-brand/10 text-brand',
        tone === 'warn' && 'bg-soft text-mute',
      )}
    >
      {icon}
    </span>
    <h3 className="mt-3 font-display text-sm font-semibold text-mute">{title}</h3>
    <p className="mt-1 font-display text-3xl font-bold leading-none">
      {price}
      <span className="ml-1.5 text-xs font-semibold text-mute">{unit}</span>
    </p>
    <p className="mt-2 text-sm text-mute">{text}</p>
  </div>
);

const Step: React.FC<{ n: number; title: string; sub: string }> = ({ n, title, sub }) => (
  <div className="flex items-center gap-3">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">
      {n}
    </span>
    <div>
      <h2 className="font-display text-base font-semibold leading-tight">{title}</h2>
      <p className="text-xs text-mute">{sub}</p>
    </div>
  </div>
);

/* ---------- page ---------- */

const Premium: React.FC = () => {
  const toast = useToast();
  const centres = useCentreOptions();
  const years = useMemo(retentionYears, []);

  const [picked, setPicked] = useState<string[] | null>(null); // null = every station
  const [keep, setKeep] = useState<number[]>([]);
  const [backup, setBackup] = useState(false);
  const [saved, setSaved] = useState<PremiumPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkDate, setCheckDate] = useState(() => toISO(new Date()));

  useEffect(() => {
    let alive = true;
    void loadPreference().then((p) => {
      if (!alive || !p) return;
      setSaved(p);
      setPicked(p.stationIds);
      setKeep(p.keepYears);
      setBackup(p.backup);
    });
    return () => {
      alive = false;
    };
  }, []);

  const ids = centres.map((c) => c.id);
  const selected = picked ?? ids;
  const allOn = ids.length > 0 && ids.every((i) => selected.includes(i));
  const someOn = selected.length > 0 && !allOn;

  const toggleStation = (id: string) =>
    setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const toggleYear = (y: number) =>
    setKeep((k) => (k.includes(y) ? k.filter((x) => x !== y) : [...k, y]));

  const quote = useMemo(() => quoteFor(selected.length, keep), [selected.length, keep]);
  const dropped = years.filter((y) => !keep.includes(y.year));

  const confirm = async () => {
    if (!selected.length) {
      toast.show('Select at least one Station ID to renew.', 'warn');
      return;
    }
    setSaving(true);
    try {
      const p = await savePreference({
        stationIds: selected,
        keepYears: keep,
        backup,
        total: quote.total,
      });
      setSaved(p);
      toast.show('Your Premium choice has been saved.', 'ok');
    } catch {
      toast.show('Could not save your choice. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    await clearPreference();
    setSaved(null);
    setPicked(null);
    setKeep([]);
    setBackup(false);
    toast.show('Saved choice removed.', 'info');
  };

  const delOn = deletionDate(checkDate);
  const left = daysUntil(delOn);
  const cutoff = cutoffDate();

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* hero */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-deep via-brand to-glow p-5 text-white shadow-pop sm:p-8"
      >
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-warn/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4 sm:gap-6">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-warn text-amber-950 shadow-lg sm:h-20 sm:w-20">
            <Crown size={34} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck size={13} aria-hidden /> Cloud Storage Renewal
            </span>
            <h1 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-4xl">SmartX Premium</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85 sm:text-base">
              Keep your collection data safe and available. Renew for {fyLabel(PREMIUM_PLAN.renewalYear)} and choose
              which previous years you want to keep.
            </p>
          </div>
        </div>
      </motion.section>

      {saved && (
        <section
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-warn/40 bg-warn/10 p-4 sm:p-5"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-warn/20 text-warn">
            <Clock3 size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold">Choice saved — payment pending</p>
            <p className="text-sm text-mute">
              {saved.stationIds.length} Station ID{saved.stationIds.length === 1 ? '' : 's'} · {inr(saved.total)} ·
              saved on {fmtDate(saved.savedAt.slice(0, 10))}. Complete the payment to activate your plan.
            </p>
          </div>
          <Link
            to="/contact"
            className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink hover:brightness-110"
          >
            Contact us to pay
          </Link>
          <Button variant="outline" onClick={() => void cancel()}>
            Remove
          </Button>
        </section>
      )}

      {/* price tiles */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <Tile
          tone="gold"
          icon={<HardDrive size={20} aria-hidden />}
          badge="Required"
          title={`Annual renewal ${fyLabel(PREMIUM_PLAN.renewalYear)}`}
          price={inr(PREMIUM_PLAN.renewalPerStation)}
          unit="per Station ID"
          text="Secure cloud storage for the coming year."
        />
        {years.map((y) => (
          <Tile
            key={y.year}
            tone="brand"
            icon={<Archive size={20} aria-hidden />}
            badge="Optional"
            title={`Keep ${y.label} data`}
            price={inr(y.perStation)}
            unit="per Station ID"
            text="Retain this year's data instead of letting it be deleted."
          />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-5">
          {/* 1 stations */}
          <section className="rounded-2xl border border-line bg-panel p-4 shadow-card sm:p-5">
            <Step n={1} title="Select Station IDs" sub="Renewal is charged for each Station ID you pick." />
            {ids.length === 0 ? (
              <p className="mt-4 rounded-xl bg-soft px-4 py-3 text-sm text-mute">No Station IDs found for this login.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <Checkbox
                    label="Select all"
                    checked={allOn}
                    indeterminate={someOn}
                    onChange={(e) => setPicked(e.target.checked ? ids : [])}
                  />
                  <span className="text-xs font-semibold text-mute">
                    {selected.length} of {ids.length} selected
                  </span>
                </div>
                <ul className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {centres.map((c) => {
                    const on = selected.includes(c.id);
                    return (
                      <li key={c.id}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition',
                            on ? 'border-brand/60 bg-brand/5' : 'border-line hover:border-brand/40',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleStation(c.id)}
                            className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-brand"
                          />
                          <span className="min-w-0 truncate font-semibold" title={c.label}>
                            {c.label}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          {/* 2 previous years */}
          <section className="rounded-2xl border border-line bg-panel p-4 shadow-card sm:p-5">
            <Step n={2} title="Keep previous year data (optional)" sub="Anything you do not keep is deleted by the rolling rule below." />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {years.map((y) => {
                const on = keep.includes(y.year);
                return (
                  <button
                    key={y.year}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggleYear(y.year)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                      on ? 'border-ok/60 bg-ok/5' : 'border-line hover:border-brand/40',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                        on ? 'bg-ok text-white' : 'bg-soft text-mute',
                      )}
                    >
                      {on ? <Check size={18} aria-hidden /> : <Archive size={18} aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">Keep {y.label} data</span>
                      <span className="block text-xs text-mute">{inr(y.perStation)} per Station ID</span>
                    </span>
                    <span className={cn('text-xs font-bold uppercase', on ? 'text-ok' : 'text-mute')}>
                      {on ? 'Keeping' : 'Delete'}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl bg-soft p-3.5">
              <Checkbox
                label="I want a backup of my data before it is deleted"
                checked={backup}
                onChange={(e) => setBackup(e.target.checked)}
              />
              <p className="mt-1 flex items-start gap-1.5 pl-7 text-xs text-mute">
                <DatabaseBackup size={14} className="mt-0.5 shrink-0" aria-hidden />
                We will arrange a downloadable copy of the data that is not being retained.
              </p>
            </div>
          </section>

          {/* rolling deletion */}
          <section className="rounded-2xl border border-line bg-panel p-4 shadow-card sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-danger/10 text-danger">
                <Trash2 size={18} aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold leading-tight">Rolling data deletion</h2>
                <p className="text-xs text-mute">
                  Data you do not keep is removed exactly {PREMIUM_PLAN.deleteAfterYears} year after it was created.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-mute">Check a collection date</span>
                <input
                  type="date"
                  value={checkDate}
                  max={toISO(new Date())}
                  onChange={(e) => e.target.value && setCheckDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm font-semibold outline-none focus:border-brand"
                />
              </label>
              <div
                className={cn(
                  'flex flex-col justify-center rounded-xl border p-3.5',
                  left < 0 ? 'border-danger/40 bg-danger/5' : 'border-line bg-soft',
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-mute">
                  <CalendarClock size={14} aria-hidden /> Deleted on
                </span>
                <span className="font-display text-lg font-bold">{fmtDate(delOn)}</span>
                <span className={cn('text-xs font-semibold', left < 0 ? 'text-danger' : 'text-mute')}>
                  {left < 0
                    ? 'Past one year: removed unless retained'
                    : left === 0
                      ? 'Deleted today'
                      : `in ${nf(left)} day${left === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn/10 px-3.5 py-3 text-sm">
              <CircleAlert size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              <span>
                Today, data created before <b>{fmtDate(cutoff)}</b> is already past one year. Example: data from 1 Apr{' '}
                {PREMIUM_PLAN.renewalYear - 1} is deleted on 1 Apr {PREMIUM_PLAN.renewalYear}. All data that is not
                retained may be deleted or become inaccessible.
              </span>
            </p>
            <p className="mt-3 text-xs text-mute">
              This ensures data privacy and optimizes storage efficiency.
            </p>
          </section>
        </div>

        {/* summary */}
        <aside className="lg:sticky lg:top-20">
          <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
            <header className="flex items-center gap-2.5 bg-gradient-to-r from-brand/10 to-transparent px-4 py-3.5">
              <Crown size={18} className="text-warn" aria-hidden />
              <h2 className="font-display text-base font-semibold">Your summary</h2>
            </header>
            <div className="space-y-3 p-4">
              {quote.lines.length === 0 ? (
                <p className="rounded-xl bg-soft px-3 py-3 text-sm text-mute">Select a Station ID to see the amount.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {quote.lines.map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block font-semibold">{l.label}</span>
                        <span className="tnum block text-xs text-mute">
                          {inr(l.rate)} × {l.qty} Station ID{l.qty === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="tnum font-semibold">{inr(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between rounded-xl bg-brand/10 px-3.5 py-3">
                <span className="font-semibold">Total to pay</span>
                <span className="tnum font-display text-2xl font-bold text-brand">{inr(quote.total)}</span>
              </div>
              {dropped.length > 0 && selected.length > 0 && (
                <p className="flex items-start gap-2 text-xs text-mute">
                  <Trash2 size={14} className="mt-0.5 shrink-0 text-danger" aria-hidden />
                  Not kept and will be deleted: {dropped.map((d) => d.label).join(', ')}.
                </p>
              )}
              <Button
                size="lg"
                loading={saving}
                disabled={!selected.length}
                icon={<Crown size={16} aria-hidden />}
                onClick={() => void confirm()}
                className="w-full bg-gradient-to-r from-brand to-glow"
              >
                {saved ? 'Update my choice' : 'Confirm my choice'}
              </Button>
              <p className="text-center text-[11px] text-mute">
                Please confirm your data retention preference before the renewal date
                {PREMIUM_PLAN.renewalDate ? ` (${fmtDate(PREMIUM_PLAN.renewalDate)})` : ''} to avoid any unintended
                data loss.
              </p>
            </div>
          </section>
        </aside>
      </div>

      <Toast message={toast.message} onClose={toast.close} />
    </div>
  );
};

export default Premium;
