import type { MilkKind } from '../types';
import { toISO } from '../lib/format';
import { hashStr, mulberry32 } from './dairy';
import { CENTRES, findCentreByName, type Shift } from './masters';

export type { Shift };

export interface Farmer {
  id: string;
  name: string;
  centre: string;
  kind: MilkKind;
  phone: string;
  perShift: number;
  fat: number;
  snf: number;
}

export interface CollectionEntry {
  id: string;
  stationId: string;
  plant: string;
  date: string;
  time: string;
  shift: Shift;
  farmerId: string;
  farmer: string;
  centre: string;
  kind: MilkKind;
  litres: number;
  fat: number;
  snf: number;
  rate: number;
  amount: number;
  /** Fields the portal API returns that the SmartX tables also show. */
  sampleNo?: string;
  kg?: number;
  clr?: number;
  water?: number;
  village?: string;
}

export const CENTRE_NAMES: string[] = CENTRES.map((c) => c.name);

const NAMES = [
  'Ramesh Patil', 'Sunita Jadhav', 'Anil Kamble', 'Vitthal More', 'Savita Shinde', 'Dattatray Pawar',
  'Mangal Chavan', 'Baban Mane', 'Rekha Kulkarni', 'Sambhaji Desai', 'Lata Gaikwad', 'Shivaji Salunkhe',
  'Pooja Kadam', 'Rajendra Bhosale', 'Kavita Sawant', 'Mahesh Jagtap', 'Archana Pawar', 'Sandip Mohite',
  'Vaishali Thorat', 'Ajit Nikam', 'Sharda Kale', 'Vijay Ghorpade', 'Manisha Patil', 'Tanaji Kharade',
  'Nanda Shelar', 'Suresh Yadav', 'Jyoti Mali', 'Pandurang Koli', 'Reshma Shaikh', 'Bhagwan Dhumal',
];

const KINDS: MilkKind[] = ['buffalo', 'cow', 'cow', 'mix', 'buffalo', 'cow'];
const FAT: Record<MilkKind, number> = { cow: 4.2, buffalo: 6.9, mix: 5.3 };
const SNF: Record<MilkKind, number> = { cow: 8.5, buffalo: 9.1, mix: 8.8 };

export const FARMERS: Farmer[] = NAMES.map((name, i) => {
  const rnd = mulberry32(hashStr(name));
  const kind = KINDS[i % KINDS.length] ?? 'cow';
  const phone = `+91 98${String(Math.floor(rnd() * 1e8)).padStart(8, '0').replace(/(\d{3})(\d{5})/, '$1 $2')}`;
  return {
    id: `F-${1001 + i}`,
    name,
    centre: CENTRE_NAMES[i % CENTRE_NAMES.length] ?? 'Kagal',
    kind,
    phone,
    perShift: Math.round(7 + rnd() * 26),
    fat: FAT[kind],
    snf: SNF[kind],
  };
});

const BASE: Record<MilkKind, number> = { cow: 34, buffalo: 54, mix: 42 };
const STD_FAT: Record<MilkKind, number> = { cow: 4, buffalo: 6.5, mix: 5 };

export function calcRate(kind: MilkKind, fat: number, snf: number): number {
  const rate = BASE[kind] + (fat - STD_FAT[kind]) * 6.5 + (snf - 8.5) * 3;
  return Math.max(0, Math.round(rate * 100) / 100);
}

const hhmm = (h: number, m: number): string => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

function build(): CollectionEntry[] {
  const out: CollectionEntry[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let seq = 0;
  for (let d = 0; d < 10; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const date = toISO(day);
    for (const shift of ['Morning', 'Evening'] as const) {
      if (d === 0 && shift === 'Evening') continue;
      for (const f of FARMERS) {
        const rnd = mulberry32(hashStr(`${date}-${shift}-${f.id}`));
        if (rnd() < 0.14) continue;
        const litres = Math.round(f.perShift * (shift === 'Morning' ? 1 : 0.8) * (0.85 + rnd() * 0.3) * 10) / 10;
        const fat = Math.round((f.fat + (rnd() - 0.5) * 0.7) * 10) / 10;
        const snf = Math.round((f.snf + (rnd() - 0.5) * 0.4) * 10) / 10;
        const rate = calcRate(f.kind, fat, snf);
        const minutes = Math.floor(rnd() * 180);
        const base = shift === 'Morning' ? 5 * 60 + 30 : 16 * 60 + 30;
        seq += 1;
        const centre = findCentreByName(f.centre);
        out.push({
          id: `C-${String(seq).padStart(5, '0')}`,
          stationId: centre?.id ?? '',
          plant: centre?.plant ?? '',
          date,
          time: hhmm(Math.floor((base + minutes) / 60), (base + minutes) % 60),
          shift,
          farmerId: f.id,
          farmer: f.name,
          centre: f.centre,
          kind: f.kind,
          litres,
          fat,
          snf,
          rate,
          amount: Math.round(litres * rate * 100) / 100,
        });
      }
    }
  }
  return out.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

export const SEED_ENTRIES: CollectionEntry[] = build();
