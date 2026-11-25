import type { RawFarmerRow } from '../types/raw';
import { kindOf, shiftOf, type Kind, type ShiftName } from '../utils/milk';
import { num as plainNum, str } from '../utils/parse';

/**
 * The DPU sends Liter as text with a thousands comma once it reaches 1,000 ("1,351.90").
 * Number("1,351.90") is NaN, so the plain parser turned such a Liter into 0.
 * Commas are removed first; every other value parses exactly as before.
 */
const num = (v: unknown): number =>
  plainNum(typeof v === 'string' ? v.replace(/,/g, '') : v);

export interface FarmerRow {
  key: string;
  
  farmerKey: string;
  farmerId: string;
  farmerName: string;
  /** name as the server sends it: original case, empty when missing (farmerName falls back to "Farmer #id") */
  rawName: string;
  vlccid: string;
  sampleNo: string;
  date: string;
  time: string;
  milk: Kind | null;
  milkLabel: string;
  shift: ShiftName | null;
  liter: number;
  kg: number;
  fat: number;
  snf: number;
  clr: number;
  water: number;
  rate: number;
  amount: number;
 
  village: string;
  stationCode: string;
  branchId: string;
}

export function mapFarmers(rows: RawFarmerRow[]): FarmerRow[] {
  return rows.map((r, i) => {
    const farmerId = str(r.farmerid);
    const vlccid = str(r.vlccid);
    return {
      key: `${vlccid}|${farmerId}|${r.sampleno}|${r.MaxId}|${i}`,
      farmerKey: `${vlccid}:${farmerId}`,
      farmerId,
      farmerName: str(r.farmername) || `Farmer #${farmerId}`,
      rawName: str(r.farmername),
      vlccid,
      sampleNo: str(r.sampleno),
      date: str(r.trdate),
      time: str(r.Time),
      milk: kindOf(r.milktype),
      milkLabel: str(r.milktype),
      shift: shiftOf(r.shift),
      liter: num(r.qty),
      kg: num(r.Kg),
      fat: num(r.fat),
      snf: num(r.snf),
      clr: num(r.clr),
      water: num(r.water),
      rate: num(r.rtpl),
      amount: num(r.amount),
      village: str(r.villageagentaddress),
      stationCode: str(r.stationcode),
      // BranchId column = the DPU field `usbflag` (e.g. "usbflag": "6"); `branchid` is only a fallback when a reply has no usbflag
      branchId: str(r.usbflag) || str(r.branchid),
    };
  });
}

export interface FarmerTotals {
  count: number;
  liter: number;
  kg: number;
  amount: number;
  avgFat: number;
  avgSnf: number;
  farmers: number;
}

export function farmerTotals(rows: FarmerRow[]): FarmerTotals {
  let liter = 0, kg = 0, amount = 0, fw = 0, sw = 0;
  const f = new Set<string>();
  for (const r of rows) {
    liter += r.liter; kg += r.kg; amount += r.amount;
    fw += r.liter * r.fat; sw += r.liter * r.snf;
    f.add(r.farmerKey);
  }
  return { count: rows.length, liter, kg, amount, avgFat: liter ? fw / liter : 0, avgSnf: liter ? sw / liter : 0, farmers: f.size };
}