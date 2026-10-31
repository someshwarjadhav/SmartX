import type { MilkKind } from '../types';

export type Shift = 'Morning' | 'Evening';

export interface Centre {
  id: string;
  name: string;
  plant: string;
}

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

export const PLANTS: string[] = ['MAIN ROUTE', 'KOLHAPUR ROUTE', 'SOUTH ROUTE'];

export const CENTRES: Centre[] = [
  { id: '0021000', name: 'BHEELPURA', plant: 'MAIN ROUTE' },
  { id: '0021001', name: 'Kagal', plant: 'MAIN ROUTE' },
  { id: '0021002', name: 'Hatkanangale', plant: 'MAIN ROUTE' },
  { id: '0021003', name: 'Shirol', plant: 'KOLHAPUR ROUTE' },
  { id: '0021004', name: 'Karveer', plant: 'KOLHAPUR ROUTE' },
  { id: '0021005', name: 'Panhala', plant: 'KOLHAPUR ROUTE' },
  { id: '0021006', name: 'Gadhinglaj', plant: 'SOUTH ROUTE' },
  { id: '0021007', name: 'Radhanagari', plant: 'SOUTH ROUTE' },
  { id: '0021008', name: 'Chandgad', plant: 'SOUTH ROUTE' },
];

export const KIND_OPTIONS: Option<MilkKind>[] = [
  { value: 'cow', label: 'Cow' },
  { value: 'buffalo', label: 'Buffalo' },
  { value: 'mix', label: 'Mix' },
];

export const SHIFT_OPTIONS: Option<Shift>[] = [
  { value: 'Morning', label: 'Morning' },
  { value: 'Evening', label: 'Evening' },
];

export const centreLabel = (c: Centre): string => `${c.name} | ${c.id}`;

export const findCentre = (id: string): Centre | undefined => CENTRES.find((c) => c.id === id);

export const findCentreByName = (name: string): Centre | undefined => CENTRES.find((c) => c.name === name);

export const toOptions = (list: string[]): Option[] => list.map((v) => ({ value: v, label: v }));
