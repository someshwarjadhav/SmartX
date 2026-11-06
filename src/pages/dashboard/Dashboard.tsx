import type * as React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Clock,
  Droplets,
  FlaskConical,
  Gauge,
  type LucideIcon,
  Milk,
  Users,
  Warehouse,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  greeting,
  initials,
  longDate,
  nf,
  pct,
  rupees,
} from "../../lib/format";
import { Segmented } from "../../components/ui/Segmented";
import {
  type CentreRow,
  type MilkKind,
  type RangeKey,
  type SupplierRow,
} from "../../types";
import type { CollectionEntry } from "../../data/farmerCollection";
import type { Summary } from "../../data/dairy";
import { Tanker } from "../../components/brand/Tanker";
import { Sparkline } from "../../components/charts/Sparkline";
import { useChartColors } from "../../context/ThemeContext";
import { cn } from "../../lib/cn";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "../../components/ui/Panel";
import { ChartTip } from "../../components/charts/ChartTip";
import { KIND_BG, KIND_LABEL, KindChip } from "../../components/ui/KindChip";
import { Badge, type Tone } from "../../components/ui/Badge";
import { useDashboardData } from "../../hooks/useDashboardData";
import {
  ALL_CENTRES,
  useTrendData,
  type TrendDays,
} from "../../hooks/useTrendData";
import { useCentreOptions } from "../../hooks/useCentres";
import { Select } from "../../components/ui/Select";
import { hasRoute, useNav } from "../../components/layout/operations/nav";

/* ---------- helpers ---------- */

// Compact y-axis label: 0, 40, 160, 1.5k ... (the old formatter turned everything under 500 L into "0k").
const litreTick = (v: number) =>
  v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(Math.round(v));

// First of these pages that the menu API allows for this user, so "View all" never lands on a "not found" page.
const useFirstAllowedRoute = (candidates: string[]): string | null => {
  const sections = useNav();
  return candidates.find((r) => hasRoute(sections, r)) ?? null;
};

const ViewAll: React.FC<{ to: string | null }> = ({ to }) =>
  to ? (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10"
    >
      View all
      <ArrowRight size={13} aria-hidden />
    </Link>
  ) : null;

/* ---------- DashboardHeader ---------- */

interface HeaderProps {
  range: RangeKey;
  onRange: (r: RangeKey) => void;
}

const DashboardHeader: React.FC<HeaderProps> = ({ range, onRange }) => {
  const { user } = useAuth();
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-6">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm text-mute">
          <CalendarDays size={15} aria-hidden />
          {longDate()}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold leading-tight sm:text-3xl">
          {greeting()}, {user?.name.split(" ")[0] ?? "there"}
        </h1>
      </div>
      <Segmented
        label="Report period"
        value={range}
        onChange={onRange}
        options={[
          { value: 7, label: "7 days" },
          { value: 30, label: "30 days" },
          { value: 90, label: "90 days" },
        ]}
      />
    </div>
  );
};

/* ---------- IntakeHero ---------- */

const IntakeHero: React.FC<{
  today: {
    litres: number;
    target: number;
    percent: number;
    remaining: number;
    shift: "Morning" | "Evening";
    shiftState: string;
    farmersPoured: number;
  };
}> = ({ today }) => {
  return (
    <section
      aria-label="Today's intake"
      className="relative min-w-0 overflow-hidden rounded-2xl border border-line text-white shadow-card"
      style={{
        background:
          "linear-gradient(145deg, rgb(var(--deep) / .84) 0%, rgb(var(--deep) / .84) 45%, rgb(var(--brand) / .5) 160%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-glow/30 blur-3xl"
        aria-hidden
      />
      <div
        className="grid-dots pointer-events-none absolute inset-0 opacity-50"
        aria-hidden
      />

      <div className="relative grid gap-2 p-5 sm:p-6 md:grid-cols-2 md:items-center xl:grid-cols-1">
        <div>
          <p className="text-sm font-medium text-white/70">
            Milk received today
          </p>
          <p className="tnum mt-1 font-display text-4xl font-extrabold leading-none sm:text-5xl">
            {nf(today.litres)}
            <span className="ml-1.5 text-xl font-semibold text-white/60">
              L
            </span>
          </p>
          <p className="mt-2 text-sm text-white/70">
            {today.target
              ? `${nf(today.percent, 0)}% of the ${nf(today.target)} L daily target`
              : "Daily target is not exposed by the portal API"}
          </p>

          <dl className="mt-5 grid grid-cols-3 gap-2 text-sm md:grid-cols-1 xl:grid-cols-3">
            <div className="min-w-0 rounded-xl bg-white/8 px-3 py-2.5">
              <dt className="flex items-start gap-1.5 text-[11px] text-white/60">
                <Clock
                  size={13}
                  className="mt-px shrink-0 text-glow"
                  aria-hidden
                />
                <span className="leading-tight">{today.shift} shift</span>
              </dt>
              <dd className="mt-1 text-[13px] leading-tight font-semibold sm:text-sm">
                {today.shiftState}
              </dd>
            </div>
            <div className="min-w-0 rounded-xl bg-white/8 px-3 py-2.5">
              <dt className="flex items-start gap-1.5 text-[11px] text-white/60">
                <Users
                  size={13}
                  className="mt-px shrink-0 text-glow"
                  aria-hidden
                />
                <span className="leading-tight">Farmers poured</span>
              </dt>
              <dd className="tnum mt-1 text-[13px] font-semibold sm:text-sm">
                {nf(today.farmersPoured)}
              </dd>
            </div>
            <div className="min-w-0 rounded-xl bg-white/8 px-3 py-2.5">
              <dt className="flex items-start gap-1.5 text-[11px] text-white/60">
                <Gauge
                  size={13}
                  className="mt-px shrink-0 text-glow"
                  aria-hidden
                />
                <span className="leading-tight">Still to receive</span>
              </dt>
              <dd className="tnum mt-1 text-[13px] font-semibold sm:text-sm">
                {nf(today.remaining)} L
              </dd>
            </div>
          </dl>
        </div>

        <div className="mx-auto w-full max-w-[560px] pt-2">
          <Tanker
            percent={today.percent}
            caption={today.target ? "of daily target" : "target not configured"}
          />
        </div>
      </div>
    </section>
  );
};

/* ---------- KpiMosaic ---------- */

interface KpiProps {
  summary: Summary;
  centres: CentreRow[];
  range: number;
}

interface Tile {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
  unit?: string;
  delta?: number;
  spark?: number[];
  color: string;
  extra?: React.ReactNode;
}

const Delta: React.FC<{ value: number }> = ({ value }) => {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        up ? "text-ok" : "text-danger",
      )}
    >
      <Icon size={13} aria-hidden />
      {pct(value)}
    </span>
  );
};

const KpiMosaic: React.FC<KpiProps> = ({ summary, centres, range }) => {
  const cc = useChartColors();
  const active = centres.filter((c) => c.status === "active").length;

  const tiles: Tile[] = [
    {
      id: "litres",
      label: "Milk received",
      icon: Milk,
      value: nf(summary.litres.value),
      unit: "L",
      delta: summary.litres.delta,
      spark: summary.litres.spark,
      color: cc.brand,
    },
    {
      id: "fat",
      label: "Average fat",
      icon: Droplets,
      value: nf(summary.fat.value, 2),
      unit: "%",
      delta: summary.fat.delta,
      spark: summary.fat.spark,
      color: cc.cow,
    },
    {
      id: "snf",
      label: "Average SNF",
      icon: FlaskConical,
      value: nf(summary.snf.value, 2),
      unit: "%",
      delta: summary.snf.delta,
      spark: summary.snf.spark,
      color: cc.mix,
    },
    {
      id: "farmers",
      label: "Farmers per day",
      icon: Users,
      value: nf(summary.farmers.value),
      delta: summary.farmers.delta,
      spark: summary.farmers.spark,
      color: cc.buffalo,
    },
    {
      id: "amount",
      label: "Payable to farmers",
      icon: Banknote,
      value: rupees(summary.amount.value),
      delta: summary.amount.delta,
      spark: summary.amount.spark,
      color: cc.ok,
    },
    {
      id: "centres",
      label: "Centres active now",
      icon: Warehouse,
      value: String(active),
      unit: `of ${centres.length}`,
      color: cc.brand,
      extra: (
        <div className="mt-3 flex gap-1" aria-hidden>
          {centres.map((c) => (
            <span
              key={c.id}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                c.status === "active"
                  ? "bg-ok"
                  : c.status === "slow"
                    ? "bg-warn"
                    : "bg-danger",
              )}
            />
          ))}
        </div>
      ),
    },
  ];

  return (
    <section
      aria-label={`Key numbers, last ${range} days`}
      className="h-full min-w-0 overflow-hidden rounded-2xl border border-line bg-line shadow-card"
    >
      <div className="grid h-full auto-rows-fr grid-cols-2 gap-px 2xl:grid-cols-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.id}
              className="relative flex min-w-0 flex-col bg-panel p-4 sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 text-xs font-semibold text-mute sm:text-sm">
                  <Icon size={15} className="shrink-0" aria-hidden />
                  <span className="truncate">{t.label}</span>
                </p>
              </div>
              <p className="tnum mt-2 truncate font-display text-xl font-bold leading-tight sm:text-2xl">
                {t.value}
                {t.unit && (
                  <span className="ml-1 text-sm font-semibold text-mute">
                    {t.unit}
                  </span>
                )}
              </p>
              {t.delta !== undefined && (
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-mute">
                  <Delta value={t.delta} />
                  <span>vs previous {range} days</span>
                </p>
              )}
              {t.spark && (
                <Sparkline
                  values={t.spark}
                  color={t.color}
                  className="mt-3 h-8 w-full"
                />
              )}
              {t.extra}
            </div>
          );
        })}
      </div>
    </section>
  );
};

/* ---------- TrendChart ---------- */

const TrendChart: React.FC = () => {
  const cc = useChartColors();
  const centres = useCentreOptions();
  const [centre, setCentre] = useState<string>(ALL_CENTRES);
  const [days, setDays] = useState<TrendDays>(30);
  const { data, loading } = useTrendData(days, centre);
  const centreLabel =
    centre === ALL_CENTRES
      ? "All centres"
      : (centres.find((c) => c.id === centre)?.label ?? centre);

  return (
    <Panel
      title="Milk collection"
      subtitle={`Litres per day, split by milk type · ${centreLabel}`}
      className="h-full"
      action={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Select
            label="Centre"
            value={centre}
            onChange={setCentre}
            className="min-w-[220px]"
            options={[
              { value: ALL_CENTRES, label: "All" },
              ...centres.map((c) => ({ value: c.id, label: c.label })),
            ]}
          />
          <Segmented
            label="Chart period"
            value={days}
            onChange={setDays}
            options={[
              { value: 7, label: "7 days" },
              { value: 14, label: "14 days" },
              { value: 30, label: "30 days" },
            ]}
          />
        </div>
      }
    >
      <div
        className={cn(
          "h-[260px] transition-opacity sm:h-[300px]",
          loading && "opacity-60",
        )}
        role="img"
        aria-label="Stacked area chart of daily litres by milk type"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 6, left: -14, bottom: 0 }}
          >
            <defs>
              {(
                [
                  ["cow", cc.cow],
                  ["buf", cc.buffalo],
                  ["mix", cc.mix],
                ] as const
              ).map(([k, c]) => (
                <linearGradient
                  key={k}
                  id={`tr-${k}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0" stopColor={c} stopOpacity={0.5} />
                  <stop offset="1" stopColor={c} stopOpacity={0.06} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke={cc.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: cc.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: cc.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={litreTick}
              width={48}
              allowDecimals={false}
            />
            <Tooltip
              content={<ChartTip format={(v) => `${nf(v)} L`} />}
              cursor={{ stroke: cc.grid }}
            />
            <Area
              type="monotone"
              dataKey="Buffalo"
              name="Buffalo"
              stackId="s"
              stroke={cc.buffalo}
              strokeWidth={2}
              fill="url(#tr-buf)"
            />
            <Area
              type="monotone"
              dataKey="Cow"
              name="Cow"
              stackId="s"
              stroke={cc.cow}
              strokeWidth={2}
              fill="url(#tr-cow)"
            />
            <Area
              type="monotone"
              dataKey="Mix"
              name="Mix"
              stackId="s"
              stroke={cc.mix}
              strokeWidth={2}
              fill="url(#tr-mix)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-semibold text-mute">
        {(
          [
            ["Buffalo", cc.buffalo],
            ["Cow", cc.cow],
            ["Mix", cc.mix],
          ] as const
        ).map(([n, c]) => (
          <li key={n} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: c }}
              aria-hidden
            />
            {n}
          </li>
        ))}
      </ul>
    </Panel>
  );
};

/* ---------- MilkMix ---------- */

const MilkMix: React.FC<{ mix: Record<MilkKind, number>; range: number }> = ({
  mix,
  range,
}) => {
  const cc = useChartColors();
  const kinds: MilkKind[] = ["buffalo", "cow", "mix"];
  const colors: Record<MilkKind, string> = {
    cow: cc.cow,
    buffalo: cc.buffalo,
    mix: cc.mix,
  };
  const total = kinds.reduce((a, k) => a + mix[k], 0);
  const data = kinds.map((k) => ({
    name: KIND_LABEL[k],
    value: mix[k],
    kind: k,
  }));

  return (
    <Panel
      title="Milk mix"
      subtitle={`Share of litres, last ${range} days`}
      className="h-full"
    >
      <div
        className="relative mx-auto h-[190px] w-full max-w-[230px]"
        role="img"
        aria-label="Donut chart of milk type share"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="66%"
              outerRadius="94%"
              paddingAngle={3}
              cornerRadius={6}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.kind} fill={colors[d.kind]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTip format={(v) => `${nf(v)} L`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="tnum font-display text-xl font-bold leading-none">
              {nf(total)}
            </p>
            <p className="mt-1 text-xs text-mute">litres</p>
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        {kinds.map((k) => {
          const share = total ? (mix[k] / total) * 100 : 0;
          return (
            <li key={k} className="flex items-center gap-3 text-sm">
              <span
                className={cn("h-2.5 w-2.5 shrink-0 rounded-full", KIND_BG[k])}
                aria-hidden
              />
              <span className="font-semibold">{KIND_LABEL[k]}</span>
              <span className="tnum ml-auto text-mute">{nf(mix[k])} L</span>
              <span className="tnum w-12 text-right font-semibold">
                {nf(share, 1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};

/* ---------- QualityChart ---------- */

interface QualityRow {
  label: string;
  Fat: number;
  SNF: number;
}

const QualityChart: React.FC<{ data: QualityRow[]; range: number }> = ({
  data,
  range,
}) => {
  const cc = useChartColors();
  return (
    <Panel
      title="Fat and SNF"
      subtitle={`Daily weighted average, last ${range} days`}
      className="h-full"
    >
      <div
        className="h-[240px]"
        role="img"
        aria-label="Line chart of average fat and SNF"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 4, left: -14, bottom: 0 }}
          >
            <CartesianGrid stroke={cc.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: cc.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              yAxisId="fat"
              domain={[4.4, 5.6]}
              ticks={[4.4, 4.7, 5.0, 5.3, 5.6]}
              tick={{ fill: cc.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => nf(v, 1)}
            />
            <YAxis
              yAxisId="snf"
              orientation="right"
              domain={[8.2, 9.0]}
              ticks={[8.2, 8.4, 8.6, 8.8, 9.0]}
              tick={{ fill: cc.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => nf(v, 1)}
            />
            <Tooltip
              content={<ChartTip format={(v) => `${nf(v, 2)}%`} />}
              cursor={{ stroke: cc.grid }}
            />
            <Line
              yAxisId="fat"
              type="monotone"
              dataKey="Fat"
              name="Fat"
              stroke={cc.cow}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="snf"
              type="monotone"
              dataKey="SNF"
              name="SNF"
              stroke={cc.buffalo}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex gap-5 text-xs font-semibold text-mute">
        <li className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: cc.cow }}
            aria-hidden
          />
          Fat (left axis)
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: cc.buffalo }}
            aria-hidden
          />
          SNF (right axis)
        </li>
      </ul>
    </Panel>
  );
};

/* ---------- ShiftChart ---------- */

interface ShiftRow {
  label: string;
  Morning: number;
  Evening: number;
}

const ShiftChart: React.FC<{ data: ShiftRow[] }> = ({ data }) => {
  const cc = useChartColors();
  return (
    <Panel
      title="Morning and evening"
      subtitle="Litres per shift, last 7 days"
      className="h-full"
    >
      <div
        className="h-[240px]"
        role="img"
        aria-label="Bar chart of morning and evening litres"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, left: -14, bottom: 0 }}
            barGap={3}
          >
            <CartesianGrid stroke={cc.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: cc.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: cc.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={litreTick}
              allowDecimals={false}
            />
            <Tooltip
              content={<ChartTip format={(v) => `${nf(v)} L`} />}
              cursor={{ fill: cc.grid }}
            />
            <Bar
              dataKey="Morning"
              name="Morning"
              fill={cc.brand}
              radius={[6, 6, 0, 0]}
              maxBarSize={18}
            />
            <Bar
              dataKey="Evening"
              name="Evening"
              fill={cc.cow}
              radius={[6, 6, 0, 0]}
              maxBarSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex gap-5 text-xs font-semibold text-mute">
        <li className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: cc.brand }}
            aria-hidden
          />
          Morning
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: cc.cow }}
            aria-hidden
          />
          Evening
        </li>
      </ul>
    </Panel>
  );
};

/* ---------- LiveFeed ---------- */

// fixed height, no scrolling: only the newest few rows are shown, "View all" opens the full list
const LIST_HEIGHT = "lg:h-[470px]";
const LATEST_ROWS = 6;
const TOP_ROWS = 5;

const LiveFeed: React.FC<{ rows: CollectionEntry[]; loading: boolean }> = ({
  rows,
  loading,
}) => {
  const to = useFirstAllowedRoute([
    "/collections",
    "/reports/farmerwise",
    "/live",
  ]);
  return (
    <Panel
      title="Latest collection records"
      subtitle="Newest samples received from the centres"
      className="h-full"
      bodyClassName="!px-0 !pb-0"
      action={
        <div className="flex items-center gap-1">
          <Badge tone="brand" dot>
            API
          </Badge>
          <ViewAll to={to} />
        </div>
      }
    >
      {loading ? (
        <div className={cn("space-y-3 p-5", LIST_HEIGHT)} aria-busy="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="skeleton block h-10 rounded" />
          ))}
        </div>
      ) : rows.length ? (
        <ul
          className={cn(
            "flex flex-col divide-y divide-line/70 overflow-hidden rounded-b-2xl",
            LIST_HEIGHT,
          )}
        >
          {rows.slice(0, LATEST_ROWS).map((r) => (
            <li
              key={r.id}
              className="grid min-h-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-3.5 sm:px-5 lg:flex-1 lg:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{r.farmer}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute">
                  <span className="tnum">
                    {r.date} {r.time}
                  </span>
                  <span>{r.centre}</span>
                  <KindChip kind={r.kind} />
                </p>
              </div>
              <div className="text-right">
                <p className="tnum text-[15px] font-semibold">
                  {nf(r.litres, 1)} L
                </p>
                <p className="tnum mt-0.5 text-xs text-mute">
                  Fat {nf(r.fat, 1)} · SNF {nf(r.snf, 1)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-6 text-sm text-mute">
          No collection rows were returned for this period.
        </div>
      )}
    </Panel>
  );
};

/* ---------- CentreTable ---------- */

const CENTRE_STATUS: Record<
  CentreRow["status"],
  { label: string; tone: Tone }
> = {
  active: { label: "Active", tone: "ok" },
  slow: { label: "Slow", tone: "warn" },
  offline: { label: "Offline", tone: "danger" },
};

const CentreTable: React.FC<{ rows: CentreRow[]; range: number }> = ({
  rows,
  range,
}) => {
  const max = Math.max(...rows.map((r) => r.litres), 1);
  return (
    <Panel
      title="Centres"
      subtitle={`Litres received per centre, last ${range} days`}
      className="h-full"
      bodyClassName="!px-0 !pb-1"
    >
      <div className="scroll-x">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-mute">
              <th scope="col" className="px-4 py-2 font-semibold sm:px-5">
                Centre
              </th>
              <th scope="col" className="px-2 py-2 font-semibold">
                Litres
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Farmers
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                Fat
              </th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">
                SNF
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-right font-semibold sm:px-5"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map((r) => {
              const s = CENTRE_STATUS[r.status];
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 sm:px-5">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-mute">{r.id}</p>
                  </td>
                  <td className="w-[34%] px-2 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-soft">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${(r.litres / max) * 100}%` }}
                        />
                      </div>
                      <span className="tnum w-20 text-right font-semibold">
                        {nf(r.litres)}
                      </span>
                    </div>
                    <p className="tnum mt-0.5 text-right text-[11px] text-mute">
                      {nf(r.share, 1)}% of total
                    </p>
                  </td>
                  <td className="tnum px-2 py-3 text-right">{nf(r.farmers)}</td>
                  <td className="tnum px-2 py-3 text-right">{nf(r.fat, 1)}</td>
                  <td className="tnum px-2 py-3 text-right">{nf(r.snf, 1)}</td>
                  <td className="px-4 py-3 text-right sm:px-5">
                    <Badge tone={s.tone} dot>
                      {s.label}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
};

/* ---------- TopSuppliers ---------- */

const TopSuppliers: React.FC<{ rows: SupplierRow[]; range: number }> = ({
  rows,
  range,
}) => {
  const max = Math.max(...rows.map((r) => r.litres), 1);
  const to = useFirstAllowedRoute([
    "/farmers",
    "/reports/farmerwise",
    "/collections",
  ]);
  return (
    <Panel
      title="Top farmers"
      subtitle={`Most litres poured, last ${range} days`}
      className="h-full"
      bodyClassName="!px-0 !pb-0"
      action={<ViewAll to={to} />}
    >
      {rows.length ? (
        <ol
          className={cn(
            "flex flex-col divide-y divide-line/70 overflow-hidden rounded-b-2xl",
            LIST_HEIGHT,
          )}
        >
          {rows.slice(0, TOP_ROWS).map((r, i) => (
            <li
              key={`${r.centre}:${r.id}`}
              className="flex min-h-0 items-center gap-3 px-4 py-3.5 sm:px-5 lg:flex-1"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/12 text-xs font-bold text-brand"
                aria-hidden
              >
                {initials(r.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[15px] font-semibold">
                    <span className="sr-only">Rank {i + 1}: </span>
                    {r.name}
                  </p>
                  <p className="tnum shrink-0 text-[15px] font-semibold">
                    {nf(r.litres)} L
                  </p>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs text-mute">
                  <span className="truncate">{r.centre}</span>
                  <KindChip kind={r.kind} />
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft">
                  <div
                    className="h-full rounded-full bg-brand/80"
                    style={{ width: `${(r.litres / max) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="p-6 text-sm text-mute">
          No farmers poured milk in this period.
        </div>
      )}
    </Panel>
  );
};

/* ---------- Page ---------- */

const Dashboard: React.FC = () => {
  const [range, setRange] = useState<RangeKey>(30);
  const data = useDashboardData(range);

  return (
    <div>
      <DashboardHeader range={range} onRange={setRange} />
      {data.error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {data.error}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <IntakeHero today={data.today} />
        </div>
        <div className="xl:col-span-7">
          <KpiMosaic
            summary={data.summary}
            centres={data.centres}
            range={range}
          />
        </div>

        <div className="xl:col-span-8">
          <TrendChart />
        </div>
        <div className="xl:col-span-4">
          <MilkMix mix={data.summary.mixByKind} range={range} />
        </div>

        <div className="xl:col-span-7">
          <QualityChart data={data.trend} range={range} />
        </div>
        <div className="xl:col-span-5">
          <ShiftChart data={data.shifts} />
        </div>

        <div className="xl:col-span-7">
          <LiveFeed rows={data.recentRows} loading={data.loading} />
        </div>
        <div className="xl:col-span-5">
          <TopSuppliers rows={data.suppliers} range={range} />
        </div>

        <div className="xl:col-span-12">
          <CentreTable rows={data.centres} range={range} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
