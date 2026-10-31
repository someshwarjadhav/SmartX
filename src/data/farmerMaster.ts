import { CENTRES } from './masters';
import { hashStr, mulberry32 } from './dairy';

export interface FarmerRecord {
  vlcId: string;
  farmerId: number;
  name: string;
  bankHolder: string;
  address: string;
  mobile: string;
  bankName: string;
  ifsc: string;
  accountNo: string;
  aadhaar: string;
  active: boolean;
}

export const farmerKey = (f: Pick<FarmerRecord, 'vlcId' | 'farmerId'>): string => `${f.vlcId}:${f.farmerId}`;

export function nextFarmerCode(farmers: FarmerRecord[], vlcId: string): number {
  return farmers.reduce((max, f) => (f.vlcId === vlcId && f.farmerId > max ? f.farmerId : max), 0) + 1;
}

const FIRST = [
  'SHYORAM', 'BANWARI LAL', 'SANTOSH', 'SUNITA', 'VINOD', 'BHAGWAN SAHAY', 'MAMTA', 'BHIVA RAM', 'SHARWAN LAL', 'SHANKAR LAL',
  'RAMESH', 'SAVITA', 'ANIL', 'MANGAL', 'REKHA', 'SAMBHAJI', 'LATA', 'DATTATRAY', 'KAVITA', 'MAHESH',
];

const LAST = ['YADAV', 'SHARMA', 'DEVI', 'JAT', 'PATIL', 'JADHAV', 'KAMBLE', 'SHINDE', 'PAWAR', 'MORE', 'CHAVAN', 'DESAI'];

const BANKS = [
  { name: 'RMGB', ifsc: 'RMGB0000463' },
  { name: 'AUBL', ifsc: 'AUBL0002211' },
  { name: 'SBI', ifsc: 'SBIN0010488' },
  { name: 'UBI', ifsc: 'UBIN0919055' },
  { name: 'HDFC', ifsc: 'HDFC0000504' },
];

const digits = (rnd: () => number, length: number): string => Array.from({ length }, () => Math.floor(rnd() * 10)).join('');

function build(): FarmerRecord[] {
  const counters = new Map<string, number>();
  return Array.from({ length: 302 }, (_, i) => {
    const centre = CENTRES[i % CENTRES.length] ?? CENTRES[0]!;
    const rnd = mulberry32(hashStr(`master-${i}`));
    const farmerId = (counters.get(centre.id) ?? 0) + 1;
    counters.set(centre.id, farmerId);
    const first = FIRST[Math.floor(rnd() * FIRST.length)] ?? 'RAMESH';
    const last = LAST[Math.floor(rnd() * LAST.length)] ?? 'PATIL';
    const bank = BANKS[Math.floor(rnd() * BANKS.length)] ?? BANKS[0]!;
    const hasMobile = rnd() > 0.45;
    return {
      vlcId: centre.id,
      farmerId,
      name: `${first} ${last}`,
      bankHolder: `${first} ${last}`,
      address: `${centre.name}, Kolhapur`,
      mobile: hasMobile ? `${7 + Math.floor(rnd() * 3)}${digits(rnd, 9)}` : '',
      bankName: rnd() > 0.7 ? bank.name : '',
      ifsc: bank.ifsc,
      accountNo: digits(rnd, 11 + Math.floor(rnd() * 6)),
      aadhaar: digits(rnd, 12),
      active: rnd() > 0.06,
    };
  });
}

export const SEED_FARMERS: FarmerRecord[] = build();
