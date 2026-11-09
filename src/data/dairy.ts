import { currentShift } from '../lib/shift';
import type { AlertRow, CentreRow, DayRecord, MilkKind, SampleFlag, SampleRow, SupplierRow, TankerRow } from '../types';
import { toISO } from '../lib/format';

export const PLANT_NAME = 'Kolhapur Chilling Plant';
export const DAILY_TARGET = 30000;
const HISTORY_DAYS = 190;

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

function buildHistory(): DayRecord[] {
  const out: DayRecord[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = HISTORY_DAYS; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = toISO(d);
    const rnd = mulberry32(hashStr(iso));
    const k = HISTORY_DAYS - i;
    const season = Math.sin(k / 13) * 2100 + Math.sin(k / 4.3) * 700;
    const total = Math.round(23800 + season + k * 6 + (rnd() - 0.5) * 1900);
    const cow = Math.round(total * (0.43 + (rnd() - 0.5) * 0.04));
    const buffalo = Math.round(total * (0.38 + (rnd() - 0.5) * 0.04));
    const mix = total - cow - buffalo;
    const morning = Math.round(total * (0.57 + (rnd() - 0.5) * 0.04));
    const fat = r2(5.05 + Math.sin(k / 9) * 0.22 + (rnd() - 0.5) * 0.18);
    const snf = r2(8.62 + Math.cos(k / 11) * 0.1 + (rnd() - 0.5) * 0.1);
    const farmers = Math.round(1180 + Math.sin(k / 7) * 60 + rnd() * 40);
    const amount = Math.round(cow * 38.5 + buffalo * 61 + mix * 47 + (fat - 5) * total * 1.2);
    out.push({ date: iso, cow, buffalo, mix, total, morning, evening: total - morning, fat, snf, farmers, amount });
  }
  return out;
}

const HISTORY: DayRecord[] = buildHistory();

export function historyDays(count: number, offset = 0): DayRecord[] {
  const end = HISTORY.length - offset;
  return HISTORY.slice(Math.max(0, end - count), end);
}

export interface Kpi {
  value: number;
  delta: number;
  spark: number[];
}

export interface Summary {
  litres: Kpi;
  fat: Kpi;
  snf: Kpi;
  farmers: Kpi;
  amount: Kpi;
  mixByKind: Record<MilkKind, number>;
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]): number => (xs.length ? sum(xs) / xs.length : 0);
const change = (now: number, before: number): number => (before === 0 ? 0 : ((now - before) / before) * 100);

function weighted(days: DayRecord[], pick: (d: DayRecord) => number): number {
  const total = sum(days.map((d) => d.total));
  if (total === 0) return 0;
  return sum(days.map((d) => pick(d) * d.total)) / total;
}

export function summarise(range: number): Summary {
  const cur = historyDays(range);
  const prev = historyDays(range, range);
  const litres = sum(cur.map((d) => d.total));
  const kpi = (value: number, before: number, spark: number[], inverse = false): Kpi => ({
    value,
    delta: inverse ? -change(value, before) : change(value, before),
    spark,
  });
  return {
    litres: kpi(litres, sum(prev.map((d) => d.total)), cur.map((d) => d.total)),
    fat: kpi(weighted(cur, (d) => d.fat), weighted(prev, (d) => d.fat), cur.map((d) => d.fat)),
    snf: kpi(weighted(cur, (d) => d.snf), weighted(prev, (d) => d.snf), cur.map((d) => d.snf)),
    farmers: kpi(Math.round(avg(cur.map((d) => d.farmers))), Math.round(avg(prev.map((d) => d.farmers))), cur.map((d) => d.farmers)),
    amount: kpi(sum(cur.map((d) => d.amount)), sum(prev.map((d) => d.amount)), cur.map((d) => d.amount)),
    mixByKind: {
      cow: sum(cur.map((d) => d.cow)),
      buffalo: sum(cur.map((d) => d.buffalo)),
      mix: sum(cur.map((d) => d.mix)),
    },
  };
}

export interface TodayIntake {
  litres: number;
  target: number;
  percent: number;
  remaining: number;
  shift: 'Morning' | 'Evening';
  shiftState: string;
  farmersPoured: number;
}

function dayProgress(hour: number): number {
  if (hour < 5) return 0.12;
  if (hour < 10) return 0.12 + ((hour - 5) / 5) * 0.45;
  if (hour < 16) return 0.57 + ((hour - 10) / 6) * 0.02;
  if (hour < 20) return 0.59 + ((hour - 16) / 4) * 0.41;
  return 1;
}

export function todayIntake(now = new Date()): TodayIntake {
  const hour = now.getHours() + now.getMinutes() / 60;
  const full = avg(historyDays(7).map((d) => d.total)) * 1.02;
  const litres = Math.round(full * dayProgress(hour));
  const morning = currentShift(now) === 'Morning';
  return {
    litres,
    target: DAILY_TARGET,
    percent: Math.min(100, (litres / DAILY_TARGET) * 100),
    remaining: Math.max(0, DAILY_TARGET - litres),
    shift: morning ? 'Morning' : 'Evening',
    shiftState: hour >= 20 || hour < 5 ? 'Closed for the day' : 'In progress',
    farmersPoured: Math.round(1210 * Math.min(1, dayProgress(hour) + 0.02)),
  };
}

const CENTRE_DEFS: Array<{ id: string; name: string; share: number; fat: number; snf: number; status: CentreRow['status'] }> = [
  { id: 'KGL', name: 'Kagal', share: 0.17, fat: 5.2, snf: 8.7, status: 'active' },
  { id: 'HTK', name: 'Hatkanangale', share: 0.15, fat: 5.0, snf: 8.6, status: 'active' },
  { id: 'SHR', name: 'Shirol', share: 0.14, fat: 5.3, snf: 8.7, status: 'active' },
  { id: 'GDL', name: 'Gadhinglaj', share: 0.12, fat: 4.9, snf: 8.5, status: 'active' },
  { id: 'KRV', name: 'Karveer', share: 0.13, fat: 5.1, snf: 8.6, status: 'active' },
  { id: 'PNL', name: 'Panhala', share: 0.11, fat: 4.8, snf: 8.5, status: 'slow' },
  { id: 'RDN', name: 'Radhanagari', share: 0.1, fat: 5.4, snf: 8.8, status: 'active' },
  { id: 'CND', name: 'Chandgad', share: 0.08, fat: 4.7, snf: 8.4, status: 'offline' },
];

export function centreTable(range: number): CentreRow[] {
  const litres = sum(historyDays(range).map((d) => d.total));
  const rows = CENTRE_DEFS.map((c) => {
    const bias = 1 + (mulberry32(hashStr(c.id + range))() - 0.5) * 0.08;
    const l = Math.round(litres * c.share * bias);
    return {
      id: c.id,
      name: c.name,
      litres: l,
      farmers: Math.round(c.share * 1200 + mulberry32(hashStr(c.id))() * 14),
      fat: c.fat,
      snf: c.snf,
      share: 0,
      status: c.status,
    } satisfies CentreRow;
  });
  const total = sum(rows.map((r) => r.litres));
  return rows
    .map((r) => ({ ...r, share: total ? (r.litres / total) * 100 : 0 }))
    .sort((a, b) => b.litres - a.litres);
}

const SUPPLIERS: Array<Omit<SupplierRow, 'litres'> & { perDay: number }> = [
  { id: 'F-1042', name: 'Ramesh Patil', centre: 'Kagal', kind: 'buffalo', perDay: 118, fat: 6.9 },
  { id: 'F-0318', name: 'Baban Mane', centre: 'Kagal', kind: 'cow', perDay: 98, fat: 4.2 },
  { id: 'F-0877', name: 'Sunita Jadhav', centre: 'Hatkanangale', kind: 'cow', perDay: 96, fat: 4.4 },
  { id: 'F-0561', name: 'Savita Shinde', centre: 'Gadhinglaj', kind: 'mix', perDay: 92, fat: 5.3 },
  { id: 'F-0742', name: 'Lata Gaikwad', centre: 'Hatkanangale', kind: 'buffalo', perDay: 90, fat: 7.1 },
  { id: 'F-0209', name: 'Vitthal More', centre: 'Karveer', kind: 'cow', perDay: 88, fat: 4.1 },
  { id: 'F-0954', name: 'Dattatray Pawar', centre: 'Panhala', kind: 'buffalo', perDay: 85, fat: 6.7 },
  { id: 'F-0433', name: 'Mangal Chavan', centre: 'Radhanagari', kind: 'cow', perDay: 80, fat: 4.5 },
  { id: 'F-0689', name: 'Rekha Kulkarni', centre: 'Shirol', kind: 'mix', perDay: 76, fat: 5.2 },
  { id: 'F-0127', name: 'Anil Kamble', centre: 'Shirol', kind: 'buffalo', perDay: 104, fat: 7.0 },
];

export function topSuppliers(range: number, take = 6): SupplierRow[] {
  return SUPPLIERS.map((s) => {
    const jitter = 0.92 + mulberry32(hashStr(s.id + range))() * 0.16;
    return { id: s.id, name: s.name, centre: s.centre, kind: s.kind, fat: s.fat, litres: Math.round(s.perDay * range * jitter) };
  })
    .sort((a, b) => b.litres - a.litres)
    .slice(0, take);
}

export const TANKERS: TankerRow[] = [
  { id: 'T-101', plate: 'MH09 FL 4821', route: 'Kagal → Plant', driver: 'Sachin Bhosale', capacity: 12000, loaded: 12000, temp: 3.8, status: 'transit', eta: '18 min' },
  { id: 'T-102', plate: 'MH09 CU 1175', route: 'Shirol → Plant', driver: 'Prakash Yadav', capacity: 10000, loaded: 6400, temp: 4.1, status: 'loading', eta: 'Loading' },
  { id: 'T-103', plate: 'MH09 BC 7302', route: 'Gadhinglaj → Plant', driver: 'Imran Shaikh', capacity: 12000, loaded: 11800, temp: 4.4, status: 'unloading', eta: 'Bay 2' },
  { id: 'T-104', plate: 'MH10 AQ 5560', route: 'Hatkanangale → Plant', driver: 'Nitin Kale', capacity: 10000, loaded: 0, temp: 5.0, status: 'waiting', eta: 'Gate queue' },
  { id: 'T-105', plate: 'MH09 DE 2094', route: 'Radhanagari → Plant', driver: 'Ganesh Thorat', capacity: 8000, loaded: 8000, temp: 3.6, status: 'done', eta: 'Unloaded 07:40' },
];

const FARMER_NAMES = SUPPLIERS.map((s) => ({ name: s.name, centre: s.centre, kind: s.kind }));

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function stamp(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

let sampleCounter = 1000;

export function makeSample(date: Date, rnd: () => number = Math.random): SampleRow {
  const who = FARMER_NAMES[Math.floor(rnd() * FARMER_NAMES.length)] ?? FARMER_NAMES[0]!;
  const ranges: Record<MilkKind, { fat: [number, number]; snf: [number, number] }> = {
    cow: { fat: [3.8, 4.9], snf: [8.2, 8.8] },
    buffalo: { fat: [6.2, 7.6], snf: [8.8, 9.5] },
    mix: { fat: [4.7, 5.8], snf: [8.4, 9.0] },
  };
  const rg = ranges[who.kind];
  let fat = rg.fat[0] + rnd() * (rg.fat[1] - rg.fat[0]);
  let snf = rg.snf[0] + rnd() * (rg.snf[1] - rg.snf[0]);
  const bad = rnd();
  if (bad < 0.09) fat -= 0.9 + rnd() * 0.6;
  else if (bad < 0.15) snf -= 0.5 + rnd() * 0.3;
  fat = r2(fat);
  snf = r2(snf);
  const flag: SampleFlag = fat < 3.5 ? 'low-fat' : snf < 8.0 ? 'low-snf' : 'ok';
  sampleCounter += 1;
  return {
    id: `S-${sampleCounter}`,
    time: stamp(date),
    farmer: who.name,
    centre: who.centre,
    kind: who.kind,
    litres: Math.round((6 + rnd() * 24) * 10) / 10,
    fat,
    snf,
    flag,
  };
}

export function seedSamples(count = 8): SampleRow[] {
  const rnd = mulberry32(hashStr('seed-samples'));
  const now = Date.now();
  const rows: SampleRow[] = [];
  for (let i = 0; i < count; i++) rows.push(makeSample(new Date(now - i * 47000), rnd));
  return rows;
}

export const ALERTS: AlertRow[] = [
  { id: 'a1', title: 'Chandgad centre offline', detail: 'No samples received since 05:40', tone: 'danger', time: '2h ago' },
  { id: 'a2', title: 'T-104 waiting at gate', detail: 'Queued for 24 minutes', tone: 'warn', time: '24m ago' },
  { id: 'a3', title: 'Low SNF at Panhala', detail: '3 samples below 8.0 this shift', tone: 'warn', time: '1h ago' },
  { id: 'a4', title: 'Rate chart updated', detail: 'New fat slabs apply from tomorrow', tone: 'info', time: 'Yesterday' },
];
