import type { FarmerRecord } from '../data/farmerMaster';
import { findCentre } from '../data/masters';

export const SAMPLE_HEADERS = [
  'Vlccid',
  'Farmer Code',
  'Farmer Name',
  'Farmer Name As Per Bank',
  'Farmer Address',
  'Mobile Number',
  'Bank Name',
  'Bank IFSC',
  'Bank Account No',
  'Aadhaar No',
  'Active',
] as const;

export interface ParseResult {
  records: FarmerRecord[];
  invalid: number;
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const ALIASES: Record<string, string[]> = {
  vlcId: ['vlccid', 'vlcid', 'centerid', 'centreid', 'centercode'],
  farmerId: ['farmercode', 'farmerid'],
  name: ['farmername', 'name'],
  bankHolder: ['farmernameasperbank', 'bankholder', 'accountholder'],
  address: ['farmeraddress', 'address'],
  mobile: ['mobilenumber', 'mobileno', 'mobile'],
  bankName: ['bankname'],
  ifsc: ['bankifsc', 'ifsc'],
  accountNo: ['bankaccountno', 'accountno', 'accountnumber'],
  aadhaar: ['aadhaarno', 'aadharno', 'aadhaar', 'aadhar'],
  active: ['active', 'status'],
};

function pick(row: Record<string, unknown>, field: string): string {
  const wanted = ALIASES[field] ?? [];
  for (const key of Object.keys(row)) {
    if (wanted.includes(norm(key))) return String(row[key] ?? '').trim();
  }
  return '';
}

const isActive = (v: string): boolean => !['inactive', 'no', 'n', '0', 'false'].includes(v.toLowerCase());

export async function parseFarmerSheet(file: File, validCentreIds?: string[]): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = book.Sheets[book.SheetNames[0] ?? ''];
  if (!sheet) return { records: [], invalid: 0 };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const records: FarmerRecord[] = [];
  let invalid = 0;

  for (const row of rows) {
    const vlcId = pick(row, 'vlcId').padStart(7, '0');
    const farmerId = Number(pick(row, 'farmerId'));
    const name = pick(row, 'name').toUpperCase();
    if (!(validCentreIds ? validCentreIds.includes(vlcId) : findCentre(vlcId)) || !Number.isInteger(farmerId) || farmerId < 1 || !name) {
      invalid += 1;
      continue;
    }
    const activeText = pick(row, 'active');
    records.push({
      vlcId,
      farmerId,
      name,
      bankHolder: pick(row, 'bankHolder').toUpperCase() || name,
      address: pick(row, 'address'),
      mobile: pick(row, 'mobile'),
      bankName: pick(row, 'bankName'),
      ifsc: pick(row, 'ifsc').toUpperCase(),
      accountNo: pick(row, 'accountNo'),
      aadhaar: pick(row, 'aadhaar'),
      active: activeText === '' ? true : isActive(activeText),
    });
  }

  return { records, invalid };
}

export async function downloadFarmerSample(): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([[...SAMPLE_HEADERS]]);
  ws['!cols'] = SAMPLE_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Farmers');
  XLSX.writeFile(wb, 'farmer-import-sample.xlsx');
}
