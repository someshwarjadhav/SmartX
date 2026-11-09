import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Droplets, IndianRupee, Pause, Play, Radio, RefreshCw, Scale, Users } from "lucide-react";
import { useInterval } from "../../components/operations/hooks";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { AnimatedNumber } from "../../components/ui/AnimatedNumber";
import { KindChip, KindDot } from "../../components/operations/KindChip";
import { LoadingBlock, Notice } from "../../components/operations/Widget";
import { MilkLoader } from '../../components/operations/MilkLoader';
import { vlccTitle } from "../../services/vlcc/names";
import { useData } from "../../context/DataContext";
import { flagOf, FLAG_META } from "../../lib/portal/quality";
import { inr, nf, todayISO } from "../../lib/portal/format";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "../../lib/portal/global";
import { KIND_META, type Kind } from "../../services/utils/milk";
import { isoFromTrdate } from "../../services/utils/date";
import { sampleStamp } from "../../services/farmer/farmerBook";
import { isLoadingQ, useSamples } from "../../hooks/useSmartxData";
import { getSession } from "../../services/session";
import { cn } from "../../lib/cn";
import { clipTitle } from '../../lib/clipTitle';

const REFRESH_MS = 60_000;

// Colour of each milk type comes from the active SmartX theme (cow / buffalo / mix tokens).
const KIND_STYLE: Record<string, { text: string; bar: string; tint: string; ring: string }> = {
  cow: { text: "text-cow", bar: "bg-cow", tint: "bg-cow/12", ring: "ring-cow/40" },
  buffalo: { text: "text-buffalo", bar: "bg-buffalo", tint: "bg-buffalo/12", ring: "ring-buffalo/40" },
  mix: { text: "text-mix", bar: "bg-mix", tint: "bg-mix/12", ring: "ring-mix/40" },
  goat: { text: "text-mix", bar: "bg-mix", tint: "bg-mix/12", ring: "ring-mix/40" },
};
const styleOf = (k: Kind | null) => KIND_STYLE[k ?? "mix"];

const clock = (ms: number | null) =>
  ms ? new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

const LiveCollection: React.FC = () => {
  const { thresholds } = useData();
  const today = todayISO();
  const [running, setRunning] = useState(true);
  const [entryPage, setEntryPage] = useState(1);
  const [entrySize, setEntrySize] = useState(DEFAULT_PAGE_SIZE);
  const [centrePage, setCentrePage] = useState(1);
  const [centreSize, setCentreSize] = useState(DEFAULT_PAGE_SIZE);
  const { q, rows } = useSamples(today, today);
  const ids = getSession()?.vlccIds ?? [];

  useInterval(
    () => {
      if (!q.fetching) q.retry();
    },
    running ? REFRESH_MS : null,
  );

  const feed = useMemo(
    () =>
      rows
        .filter((r) => isoFromTrdate(r.date) === today)
        .sort((a, b) => (sampleStamp(a) < sampleStamp(b) ? 1 : -1)),
    [rows, today],
  );
  const latest = feed[0];

  // Entries that arrive between two refreshes are lit for a moment.
  const seen = useRef<Set<string> | null>(null);
  const lit = useRef<Set<string>>(new Set());
  const keysNow = feed.map((r) => r.key);
  if (feed.length > 0) {
    if (seen.current === null) {
      seen.current = new Set(keysNow);
      lit.current = new Set([keysNow[0]]);
    } else {
      const fresh = keysNow.filter((k) => !seen.current!.has(k));
      if (fresh.length > 0) {
        lit.current = new Set(fresh);
        fresh.forEach((k) => seen.current!.add(k));
      }
    }
  }

  const totalLiter = feed.reduce((a, r) => a + r.liter, 0);
  const totalAmount = feed.reduce((a, r) => a + r.amount, 0);
  const farmerCount = new Set(feed.map((r) => r.farmerKey)).size;
  const avgFat = totalLiter ? feed.reduce((a, r) => a + r.fat * r.liter, 0) / totalLiter : 0;
  const avgSnf = totalLiter ? feed.reduce((a, r) => a + r.snf * r.liter, 0) / totalLiter : 0;

  const kinds: Kind[] = ["cow", "buffalo", "mix"];
  const totals = kinds.map((k) => {
    const rs = feed.filter((r) => (r.milk === "goat" ? "mix" : r.milk) === k);
    return { k, liter: rs.reduce((a, r) => a + r.liter, 0), count: rs.length };
  });
  const perCentre = useMemo(() => {
    const max = Math.max(1, ...ids.map((id) => feed.filter((r) => r.vlccid === id).length));
    return ids
      .map((id) => {
        const rs = feed.filter((r) => r.vlccid === id);
        return {
          id,
          count: rs.length,
          liter: rs.reduce((a, r) => a + r.liter, 0),
          village: rs[0]?.village ?? "",
          share: rs.length / max,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [ids, feed]);

  const loading = isLoadingQ(q);
  const pageCount = (n: number, s: number) => Math.max(1, Math.ceil(n / s));
  const entryAt = Math.min(entryPage, pageCount(feed.length, entrySize));
  const entryRows = feed.slice((entryAt - 1) * entrySize, entryAt * entrySize);
  const centreAt = Math.min(centrePage, pageCount(perCentre.length, centreSize));
  const centreRows = perCentre.slice((centreAt - 1) * centreSize, centreAt * centreSize);

  // Drives the thin progress bar under the hero; restarts after every successful refresh.
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (q.updatedAt) setCycle((c) => c + 1);
  }, [q.updatedAt]);

  const hero: Array<{ label: string; node: React.ReactNode; icon: React.ReactNode }> = [
    { label: "Litres today", icon: <Droplets size={16} />, node: <><AnimatedNumber value={totalLiter} format={(n) => nf(n, 1)} /> <span className="text-sm font-semibold text-deep-ink/80">L</span></> },
    { label: "Samples", icon: <Radio size={16} />, node: <AnimatedNumber value={feed.length} format={(n) => nf(n)} /> },
    { label: "Farmers", icon: <Users size={16} />, node: <AnimatedNumber value={farmerCount} format={(n) => nf(n)} /> },
    { label: "Avg fat · SNF", icon: <Scale size={16} />, node: <>{nf(avgFat, 2)} <span className="text-deep-ink/60">·</span> {nf(avgSnf, 2)}</> },
    { label: "Amount", icon: <IndianRupee size={16} />, node: <AnimatedNumber value={totalAmount} format={(n) => inr(n)} /> },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Live collection"
        subtitle="Today's samples exactly as the SmartX portal holds them. The feed refreshes every minute."
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={16} className={q.fetching ? "animate-spin360" : ""} />} onClick={() => q.retry()} disabled={q.fetching}>
              Refresh now
            </Button>
            <Button variant={running ? "soft" : "primary"} icon={running ? <Pause size={16} /> : <Play size={16} />} onClick={() => setRunning((r) => !r)}>
              {running ? "Pause refresh" : "Resume refresh"}
            </Button>
          </>
        }
      />
      <Notice q={q} />

      {/* Control-room strip: the day so far at a glance */}
      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 p-4 text-deep-ink shadow-pop sm:p-6"
        style={{ background: "linear-gradient(135deg, rgb(var(--deep)) 0%, rgb(var(--deep) / .94) 55%, rgb(var(--brand) / .6) 190%)" }}
        aria-label="Today's collection summary"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-glow/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-brand/20 blur-3xl" aria-hidden />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative grid h-3 w-3 place-items-center" aria-hidden>
              {running && <span className="absolute h-3 w-3 animate-pulseDot rounded-full bg-ok" />}
              <span className={cn("h-3 w-3 rounded-full", running ? "bg-ok" : "bg-warn")} />
            </span>
            <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-white">{running ? "On air" : "Paused"}</p>
          </div>
          <p className="tnum rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
            {q.fetching ? "Updating…" : `Updated ${clock(q.updatedAt)}`}
          </p>
        </div>

        <dl className="relative mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          {hero.map((h) => (
            <div key={h.label} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-deep-ink/70">
                {h.icon}
                <span className="truncate">{h.label}</span>
              </dt>
              <dd className="tnum mt-1 truncate font-display text-xl font-extrabold text-white sm:text-2xl">{h.node}</dd>
            </div>
          ))}
        </dl>

        <div className="relative mt-5 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
          {running && (
            <motion.div key={cycle} className="h-full origin-left rounded-full bg-glow" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: REFRESH_MS / 1000, ease: "linear" }} />
          )}
        </div>
      </section>

      {/* Milk type split */}
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {totals.map((t) => {
          const st = styleOf(t.k);
          const share = totalLiter ? (t.liter / totalLiter) * 100 : 0;
          return (
            <div key={t.k} className="group relative overflow-hidden rounded-2xl border border-line bg-panel p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop sm:p-5">
              <div className="flex items-center gap-3">
                <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1", st.tint, st.ring)}>
                  <KindDot kind={t.k} size={34} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase tracking-wider text-mute">{KIND_META[t.k].label} today</p>
                  <p className="tnum font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                    {nf(t.liter, 1)} <span className="text-sm font-semibold text-mute">L</span>
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-mute">
                <span className="tnum">{t.count} samples</span>
                <span className={cn("tnum font-bold", st.text)}>{nf(share, 0)}% of today</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft">
                <motion.div className={cn("h-full rounded-full", st.bar)} initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid items-start gap-5 sm:gap-6 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
          {/* Latest slip, drawn like a weighing-scale receipt */}
          <Panel
            title="Latest slip"
            subtitle="The newest sample received today"
            action={running ? <Badge tone="ok" dot>Auto refresh</Badge> : <Badge>Paused</Badge>}
          >
            <AnimatePresence mode="wait">
              {latest ? (
                <motion.div
                  key={latest.key}
                  initial={{ opacity: 0, y: -22, rotate: -1.5 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, y: 14 }}
                  transition={{ type: "spring", damping: 18 }}
                  className="relative overflow-hidden rounded-2xl border border-line bg-soft/60"
                >
                  <div className={cn("h-1.5 w-full", styleOf(latest.milk).bar)} aria-hidden />
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-mute">Farmer {latest.farmerId}</p>
                        <p className="truncate font-display text-lg font-extrabold sm:text-xl">{latest.farmerName}</p>
                      </div>
                      <KindChip kind={latest.milk} label={latest.milkLabel} />
                    </div>

                    <div className="my-4 grid grid-cols-3 gap-2 rounded-xl bg-panel p-3 text-center shadow-card">
                      {[
                        ["Litres", latest.liter],
                        ["Fat %", latest.fat],
                        ["SNF %", latest.snf],
                      ].map(([label, v]) => (
                        <div key={String(label)}>
                          <p className="tnum font-display text-xl font-extrabold sm:text-2xl">{v}</p>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-mute">{label}</p>
                        </div>
                      ))}
                    </div>

                    <dl className="space-y-1.5 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-mute">Rate per litre</dt>
                        <dd className="tnum font-semibold">{inr(latest.rate, 2)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-mute">CLR · Water</dt>
                        <dd className="tnum font-semibold">{latest.clr} · {latest.water}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-line pt-2.5">
                        <dt className="font-bold">Amount</dt>
                        <dd className="tnum font-display text-xl font-extrabold text-brand">{inr(latest.amount, 2)}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-mute">
                      {vlccTitle(latest.vlccid, latest.village)} · {latest.time} · Sample {latest.sampleNo}
                    </p>
                  </div>
                </motion.div>
              ) : loading ? (
                <LoadingBlock height="h-48" />
              ) : (
                <EmptyState icon={Radio} title="No sample yet today" text="Entries appear here as soon as a farmer pours milk." />
              )}
            </AnimatePresence>
          </Panel>

          {/* Centres today */}
          <Panel
            title="Centres today"
            subtitle={`${perCentre.filter((c) => c.count > 0).length} of ${perCentre.length} centres have sent samples`}
            bodyClassName="px-0 pb-0 sm:pb-0 sm:px-0"
          >
            <ul className="space-y-2 px-4 pb-4 sm:px-5">
              {centreRows.map((c) => (
                <li key={c.id} className="rounded-xl border border-line/80 bg-soft/50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{vlccTitle(c.id, c.village)}</p>
                      <p className="tnum text-xs text-mute">VLC {c.id} · {nf(c.liter, 1)} L</p>
                    </div>
                    <Badge tone={c.count > 0 ? "ok" : "neutral"} dot>
                      {c.count} samples
                    </Badge>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-line/70">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand to-glow transition-[width] duration-700" style={{ width: `${c.share * 100}%` }} />
                  </div>
                </li>
              ))}
              {perCentre.length === 0 && <li><EmptyState title="No centres" text="This login has no centres attached." /></li>}
            </ul>
            {perCentre.length > 0 && (
              <Pagination
                page={centreAt}
                pageSize={centreSize}
                total={perCentre.length}
                onPage={setCentrePage}
                onPageSize={(n) => { setCentreSize(n); setCentrePage(1); }}
                sizes={PAGE_SIZE_OPTIONS}
              />
            )}
          </Panel>
        </div>

        {/* Incoming entries: table on wide screens, cards on phones */}
        <Panel
          title="Incoming entries"
          subtitle={`Newest first · ${feed.length} today`}
          bodyClassName="px-0 pb-0 sm:pb-0 sm:px-0"
        >
          {feed.length === 0 ? (
            loading ? <MilkLoader label="Loading entries…" /> : <EmptyState icon={Radio} title="No entries yet" text="Nothing has been received from the centres today." />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="clip-cells w-full min-w-[720px] border-separate border-spacing-0 text-sm" onMouseOver={clipTitle}>
                  <thead>
                    <tr className="text-left text-xs font-semibold text-mute">
                      {["Farmer", "Centre", "Time", "Milk", "Litres", "Fat", "SNF", "Amount", ""].map((h, i) => (
                        <th key={h + i} scope="col" className={cn("sticky top-0 whitespace-nowrap border-y border-line bg-soft/70 px-4 py-3", i >= 4 && i <= 7 && "text-right")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entryRows.map((c) => {
                      const flag = flagOf(c, thresholds);
                      const st = styleOf(c.milk);
                      return (
                        <tr key={c.key} className={cn("transition-colors duration-500 hover:bg-brand/[0.06]", lit.current.has(c.key) && cn(st.tint, "ring-1 ring-inset", st.ring))}>
                          <td className="border-b border-line/70 px-4 py-2.5">
                            <p className="font-semibold">{c.farmerName}</p>
                            <p className="text-xs text-mute">#{c.farmerId}</p>
                          </td>
                          <td className="border-b border-line/70 px-4 py-2.5 text-mute">{vlccTitle(c.vlccid, c.village)}</td>
                          <td className="tnum whitespace-nowrap border-b border-line/70 px-4 py-2.5 text-mute">{c.time}</td>
                          <td className="border-b border-line/70 px-4 py-2.5"><KindChip kind={c.milk} label={c.milkLabel} compact /></td>
                          <td className="tnum border-b border-line/70 px-4 py-2.5 text-right font-bold">{c.liter}</td>
                          <td className="tnum border-b border-line/70 px-4 py-2.5 text-right">{c.fat}</td>
                          <td className="tnum border-b border-line/70 px-4 py-2.5 text-right">{c.snf}</td>
                          <td className="tnum border-b border-line/70 px-4 py-2.5 text-right font-bold">{inr(c.amount)}</td>
                          <td className="border-b border-line/70 px-4 py-2.5">{flag && <Badge tone="warn">{FLAG_META[flag].label}</Badge>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-line/70 border-t border-line md:hidden">
                {entryRows.map((c) => {
                  const flag = flagOf(c, thresholds);
                  const st = styleOf(c.milk);
                  return (
                    <li key={c.key} className={cn("px-4 py-3 transition-colors duration-500", lit.current.has(c.key) && st.tint)}>
                      <div className="flex items-start gap-3">
                        <KindDot kind={c.milk ?? "mix"} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{c.farmerName}</p>
                          <p className="truncate text-xs text-mute">{vlccTitle(c.vlccid, c.village)} · {c.time}</p>
                        </div>
                        <p className="tnum shrink-0 text-right font-bold">{inr(c.amount)}</p>
                      </div>
                      <div className="tnum mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-12 text-xs text-mute">
                        <span className="font-bold text-ink">{c.liter} L</span>
                        <span>Fat {c.fat}</span>
                        <span>SNF {c.snf}</span>
                        {flag && <Badge tone="warn">{FLAG_META[flag].label}</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <Pagination
                page={entryAt}
                pageSize={entrySize}
                total={feed.length}
                onPage={setEntryPage}
                onPageSize={(n) => { setEntrySize(n); setEntryPage(1); }}
                sizes={PAGE_SIZE_OPTIONS}
              />
            </>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default LiveCollection;
