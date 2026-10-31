export type MilkKind = 'cow' | 'buffalo' | 'mix';
export type RangeKey = 7 | 30 | 90;
export type SampleFlag = 'ok' | 'low-fat' | 'low-snf';
export type TankerStatus = 'loading' | 'transit' | 'unloading' | 'waiting' | 'done';

export interface DayRecord {
  date: string;
  cow: number;
  buffalo: number;
  mix: number;
  total: number;
  morning: number;
  evening: number;
  fat: number;
  snf: number;
  farmers: number;
  amount: number;
}

export interface CentreRow {
  id: string;
  name: string;
  litres: number;
  farmers: number;
  fat: number;
  snf: number;
  share: number;
  status: 'active' | 'slow' | 'offline';
}

export interface SupplierRow {
  id: string;
  name: string;
  centre: string;
  kind: MilkKind;
  litres: number;
  fat: number;
}

export interface TankerRow {
  id: string;
  plate: string;
  route: string;
  driver: string;
  capacity: number;
  loaded: number;
  temp: number;
  status: TankerStatus;
  eta: string;
}

export interface SampleRow {
  id: string;
  time: string;
  farmer: string;
  centre: string;
  kind: MilkKind;
  litres: number;
  fat: number;
  snf: number;
  flag: SampleFlag;
}

export interface AlertRow {
  id: string;
  title: string;
  detail: string;
  tone: 'danger' | 'warn' | 'info';
  time: string;
}
