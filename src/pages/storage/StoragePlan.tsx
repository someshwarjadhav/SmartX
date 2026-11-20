import type * as React from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Archive,
  CalendarClock,
  Check,
  CircleAlert,
  Clock3,
  Cloud,
  Crown,
  DatabaseBackup,
  HardDrive,
  Layers,
  Minus,
  Sparkles,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useCentreOptions } from '../../hooks/useCentres';
import { useToast } from '../../hooks/useToast';
import { Toast } from '../../components/ui/Toast';
import { Checkbox } from '../../components/ui/Checkbox';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { fmtDate, nf, toISO } from '../../lib/format';
import {
  CUSTOM_ADDONS,
  CUSTOM_SLABS,
  PLAN_FEATURES,
  PLAN_HIKES,
  PLAN_INCLUDED,
  PLAN_TIERS,
  STORAGE_PLAN,
  customSurchargePct,
  fyLabel,
  planPrices,
  type PlanId,
} from '../../config/storagePlan';
import {
  clearPreference,
  customSubtotal,
  cutoffDate,
  daysUntil,
  deletionDate,
  loadPreference,
  quoteFor,
  retentionYears,
  savePreference,
  type StoragePreference,
} from '../../services/storage/storagePlan.api';

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

/** "5 Station IDs · 5 Users free": shown in every box so the customer never forgets it is included */
const FreeChip: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-2.5 py-1 text-[11px] font-bold text-ok',
      className,
    )}
  >
    <Users size={12} aria-hidden />
    {PLAN_INCLUDED.stations} Station IDs · {PLAN_INCLUDED.users} Users free
  </span>
);

const TIER_ICON: Record<PlanId, LucideIcon> = { regular: Layers, pro: Zap, proplus: Sparkles, advance: Crown };

const Step: React.FC<{ n: number; title: string; sub: string; free?: boolean }> = ({ n, title, sub, free }) => (
  <div className="flex items-center gap-3">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">
      {n}
    </span>
    <div className="min-w-0 flex-1">
      <h2 className="font-display text-base font-semibold leading-tight">{title}</h2>
      <p className="text-xs text-mute">{sub}</p>
    </div>
    {free && <FreeChip className="hidden shrink-0 sm:inline-flex" />}
  </div>
);

/* ---------- page ---------- */

const StoragePlan: React.FC = () => {
  const toast = useToast();
  const centres = useCentreOptions();
  const years = useMemo(retentionYears, []);
  const prices = useMemo(planPrices, []);

  const [picked, setPicked] = useState<string[] | null>(null); // null = every station
  const [keep, setKeep] = useState<number[]>([]);
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState('');
  const [customAmount, setCustomAmount] = useState(0);
  const [backup, setBackup] = useState(false);
  const [saved, setSaved] = useState<StoragePreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkDate, setCheckDate] = useState(() => toISO(new Date()));

  useEffect(() => {
    let alive = true;
    void loadPreference().then((p) => {
      if (!alive || !p) return;
      setSaved(p);
      setPicked(p.stationIds);
      setKeep(p.keepYears);
      setPlanId(p.planId ?? null);
      setCustomIds(p.customIds ?? []);
      setCustomNote(p.customNote ?? '');
      setCustomAmount(p.customAmount ?? 0);
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

  const toggleCustom = (id: string) =>
    setCustomIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const quote = useMemo(
    () => quoteFor(selected.length, keep, { planId, customIds, customAmount }),
    [selected.length, keep, planId, customIds, customAmount],
  );
  const tierIdx = PLAN_TIERS.findIndex((t) => t.id === planId);
  const tier = tierIdx >= 0 ? PLAN_TIERS[tierIdx] : undefined;
  const customTotal = customSubtotal(customIds, customAmount);
  const customPct = customSurchargePct(customTotal);
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
        planId,
        customIds,
        customNote: customNote.trim(),
        customAmount,
        backup,
        total: quote.total,
      });
      setSaved(p);
      toast.show('Your Storage Plan choice has been saved.', 'ok');
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
    setPlanId(null);
    setCustomIds([]);
    setCustomNote('');
    setCustomAmount(0);
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
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-white to-sky-100 text-brand shadow-lg sm:h-20 sm:w-20">
            <Cloud size={34} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck size={13} aria-hidden /> Storage Plan
            </span>
            <h1 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-4xl">Cloud Storage Renewal &amp; Data Retention Policy</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85 sm:text-base">
              Pick the plan that fits your dairy, renew for {fyLabel(STORAGE_PLAN.renewalYear)} and choose which
              previous years you want to keep.
            </p>
            <FreeChip className="mt-3 bg-white/15 text-white" />
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
              {PLAN_TIERS.find((t) => t.id === saved.planId)?.name
                ? `${PLAN_TIERS.find((t) => t.id === saved.planId)?.name} plan · `
                : ''}
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

      {/* 1 plans */}
      <section className="rounded-2xl border border-line bg-panel p-4 shadow-card sm:p-5">
        <Step
          n={1}
          title="Choose your plan"
          sub="Every step up costs a little more and gives a lot more."
          free
        />
        <div role="radiogroup" aria-label="Plan" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PLAN_TIERS.map((t, i) => {
            const on = planId === t.id;
            const Icon = TIER_ICON[t.id];
            const price = prices[i] ?? 0;
            const prev = i > 0 ? (prices[i - 1] ?? 0) : 0;
            const mine = PLAN_FEATURES.filter((f) => f.from <= i);
            const fresh = PLAN_FEATURES.filter((f) => f.from === i);
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPlanId(on ? null : t.id)}
                className={cn(
                  'relative flex flex-col rounded-2xl border p-4 text-left transition',
                  on
                    ? 'border-brand bg-brand/5 ring-2 ring-brand/40'
                    : t.ribbon
                      ? 'border-warn/50 hover:border-brand/60'
                      : 'border-line hover:border-brand/50',
                )}
              >
                {t.ribbon && (
                  <span
                    className={cn(
                      'absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white',
                      t.id === 'advance' ? 'bg-ok' : 'bg-warn',
                    )}
                  >
                    {t.ribbon}
                  </span>
                )}
                <span className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'grid h-10 w-10 place-items-center rounded-xl',
                      on ? 'bg-brand text-brand-ink' : 'bg-brand/10 text-brand',
                    )}
                  >
                    <Icon size={19} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-bold leading-tight">{t.name}</span>
                    <span className="block text-xs text-mute">{t.tagline}</span>
                  </span>
                </span>
                <span className="mt-4 block font-display text-3xl font-bold leading-none">
                  {inr(price)}
                  <span className="ml-1.5 text-xs font-semibold text-mute">first registration</span>
                </span>
                <span className="mt-1 block text-xs text-mute">just {inr(Math.round(price / 12))} a month</span>
                {i > 0 && (
                  <span className="mt-2 block rounded-lg bg-warn/10 px-2.5 py-1.5 text-xs font-semibold">
                    Only {inr(price - prev)} more (+{PLAN_HIKES[i]}%) than {PLAN_TIERS[i - 1]?.name} to get {t.adds.toLowerCase()}
                  </span>
                )}
                <FreeChip className="mt-3 self-start" />
                <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                  {i > 0 && (
                    <li className="flex items-start gap-2 font-semibold">
                      <Check size={15} className="mt-0.5 shrink-0 text-ok" aria-hidden />
                      Everything in {PLAN_TIERS[i - 1]?.name}
                    </li>
                  )}
                  {(i === 0 ? mine : fresh).map((f) => (
                    <li key={f.id} className="flex items-start gap-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-ok" aria-hidden />
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>
                <span
                  className={cn(
                    'mt-4 inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold',
                    on ? 'bg-brand text-brand-ink' : 'border border-line bg-panel',
                  )}
                >
                  {on ? 'Selected' : `Choose ${t.name}`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-mute">
          Not buying a new plan, only renewing storage? Leave all plans unselected: you pay just the renewal below.
        </p>

        {/* comparison */}
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-soft text-left">
                <th className="px-3 py-2.5 font-semibold">What you get</th>
                {PLAN_TIERS.map((t) => (
                  <th key={t.id} className={cn('px-3 py-2.5 text-center font-semibold', t.id === planId && 'text-brand')}>
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="px-3 py-2 font-semibold">Station IDs · Users</td>
                {PLAN_TIERS.map((t) => (
                  <td key={t.id} className="px-3 py-2 text-center font-bold text-ok">
                    {PLAN_INCLUDED.stations} · {PLAN_INCLUDED.users}
                  </td>
                ))}
              </tr>
              {(['Collection', 'Billing', 'Deductions & Accounts', 'Advance & Control'] as const).map((g) => (
                <Fragment key={g}>
                  <tr className="bg-soft/60">
                    <td colSpan={PLAN_TIERS.length + 1} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-mute">
                      {g}
                    </td>
                  </tr>
                  {PLAN_FEATURES.filter((f) => f.group === g).map((f) => (
                    <tr key={f.id}>
                      <td className="px-3 py-2">{f.label}</td>
                      {PLAN_TIERS.map((t, i) => (
                        <td key={t.id} className="px-3 py-2 text-center">
                          {f.from <= i ? (
                            <Check size={16} className="mx-auto text-ok" aria-label="Included" />
                          ) : (
                            <Minus size={16} className="mx-auto text-mute/50" aria-label="Not included" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="bg-soft">
                <td className="px-3 py-2.5 font-semibold">First registration</td>
                {PLAN_TIERS.map((t, i) => (
                  <td key={t.id} className="tnum px-3 py-2.5 text-center font-display font-bold">
                    {inr(prices[i] ?? 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* price tiles */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <Tile
          tone="gold"
          icon={<HardDrive size={20} aria-hidden />}
          badge="Required"
          title={`Annual renewal ${fyLabel(STORAGE_PLAN.renewalYear)}`}
          price={inr(STORAGE_PLAN.renewalPerStation)}
          unit="per Station ID"
          text={`Secure cloud storage for the coming year. First ${PLAN_INCLUDED.stations} Station IDs are free with any plan.`}
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
            <Step
              n={2}
              title="Select Station IDs"
              sub={
                tier
                  ? `First ${PLAN_INCLUDED.stations} Station IDs (1 user each) are free with ${tier.name}; extra ones pay the renewal.`
                  : 'Renewal is charged for each Station ID you pick.'
              }
              free
            />
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
                    const isFree = !!tier && on && selected.indexOf(c.id) < PLAN_INCLUDED.stations;
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
                          <span className="min-w-0 flex-1 truncate font-semibold" title={c.label}>
                            {c.label}
                          </span>
                          {isFree && (
                            <span className="shrink-0 rounded-full bg-ok/10 px-2 py-0.5 text-[10px] font-bold uppercase text-ok">
                              Free · 1 user
                            </span>
                          )}
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
            <Step n={3} title="Keep previous year data (optional)" sub="Anything you do not keep is deleted by the rolling rule below." />
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

          {/* 4 customise */}
          <section className="rounded-2xl border border-line bg-panel p-4 shadow-card sm:p-5">
            <Step
              n={4}
              title="Customise your software (optional)"
              sub="Tick what you need or describe it. The more you customise, the higher the rate."
              free
            />
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {CUSTOM_ADDONS.map((a) => {
                const on = customIds.includes(a.id);
                return (
                  <li key={a.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition',
                        on ? 'border-brand/60 bg-brand/5' : 'border-line hover:border-brand/40',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleCustom(a.id)}
                        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-brand"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{a.label}</span>
                        <span className="block text-xs text-mute">{a.note}</span>
                      </span>
                      <span className="tnum shrink-0 font-semibold">{inr(a.price)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-mute">Something else you need? Tell us</span>
                <textarea
                  value={customNote}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. a new report, a different bill format, a new screen…"
                  className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-mute">Custom work amount (₹)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={500}
                  value={customAmount === 0 ? '' : customAmount}
                  placeholder="0"
                  onChange={(e) => setCustomAmount(Math.max(0, Math.round(Number(e.target.value)) || 0))}
                  className="tnum h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm font-semibold outline-none focus:border-brand"
                />
                <span className="mt-1 block text-[11px] text-mute">Amount quoted by our team for your requirement.</span>
              </label>
            </div>

            <div className="mt-4 rounded-xl bg-soft p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-mute">
                <SlidersHorizontal size={14} aria-hidden /> Customisation charge by size
              </p>
              <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                {CUSTOM_SLABS.map((sl, i) => {
                  const from = i === 0 ? 0 : (CUSTOM_SLABS[i - 1]?.upTo ?? 0);
                  const active = customTotal > from && customTotal <= sl.upTo;
                  return (
                    <li
                      key={sl.upTo}
                      className={cn(
                        'flex items-center justify-between rounded-lg px-3 py-1.5',
                        active ? 'bg-brand/10 font-semibold text-brand' : 'text-mute',
                      )}
                    >
                      <span>
                        {Number.isFinite(sl.upTo) ? `Up to ${inr(sl.upTo)}` : `Above ${inr(from)}`}
                      </span>
                      <span>{sl.surchargePct === 0 ? 'No extra' : `+${sl.surchargePct}%`}</span>
                    </li>
                  );
                })}
              </ul>
              {customTotal > 0 && (
                <p className="mt-2 text-xs text-mute">
                  Your customisation: <b>{inr(customTotal)}</b>
                  {customPct > 0 ? ` · +${customPct}% charge applies` : ' · no extra charge'}.
                </p>
              )}
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
                  Data you do not keep is removed exactly {STORAGE_PLAN.deleteAfterYears} year after it was created.
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
                {STORAGE_PLAN.renewalYear - 1} is deleted on 1 Apr {STORAGE_PLAN.renewalYear}. All data that is not
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
              <Cloud size={18} className="text-brand" aria-hidden />
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
                          {l.unit === 'Station ID'
                            ? `${inr(l.rate)} × ${l.qty} Station ID${l.qty === 1 ? '' : 's'}`
                            : l.note}
                        </span>
                      </span>
                      <span className="tnum font-semibold">{inr(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {selected.length > 0 && tier && <FreeChip />}
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
                icon={<Cloud size={16} aria-hidden />}
                onClick={() => void confirm()}
                className="w-full bg-gradient-to-r from-brand to-glow"
              >
                {saved ? 'Update my choice' : 'Confirm my choice'}
              </Button>
              <p className="text-center text-[11px] text-mute">
                Please confirm your data retention preference before the renewal date
                {STORAGE_PLAN.renewalDate ? ` (${fmtDate(STORAGE_PLAN.renewalDate)})` : ''} to avoid any unintended
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

export default StoragePlan;
