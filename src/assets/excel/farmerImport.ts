import type { FarmerRecord } from '../../data/farmerMaster';
import { excelFileName } from './fileName';
import { findCentre } from '../../data/masters';

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
  vlcId: ['vlccid', 'vlcid', 'centerid', 'centreid', 'centercode', 'villageid'],
  farmerId: ['farmercode', 'farmerid'],
  name: ['farmername', 'name'],
  bankHolder: ['farmernameasperbank', 'bankholder', 'accountholder', 'nameinbank'],
  address: ['farmeraddress', 'address'],
  mobile: ['mobilenumber', 'mobileno', 'mobile', 'farmercontact'],
  bankName: ['bankname', 'farmerbank'],
  ifsc: ['bankifsc', 'ifsc', 'bankifsccode'],
  accountNo: ['bankaccountno', 'accountno', 'accountnumber', 'farmerbankac'],
  aadhaar: ['aadhaarno', 'aadharno', 'aadhaar', 'aadhar', 'farmeraadhaar'],
  active: ['active', 'status', 'farmerstatus'],
  cow: ['farmercow', 'cow', 'milktype', 'cowbuff'],
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
      cow: pick(row, 'cow').toLowerCase(),
    });
  }

  return { records, invalid };
}

/**
 * Sample file = the FarmerAccount.xlsx layout: the same 12 columns and the same dummy rows
 * (farmerid ... farmeraadhaar, farmercow), so the sheet can be filled in and imported back as it is.
 */
export const SAMPLE_COLUMNS = [
  'farmerid', 'farmername', 'nameinbank', 'farmeraddress', 'farmercontact', 'farmerbank',
  'bankifsccode', 'farmerbankac', 'farmerstatus', 'villageid', 'farmeraadhaar', 'farmercow',
] as const;

const SAMPLE_ROWS: Array<Array<string | number>> = [
  [498, 'Ravi', 'ABC XYZ', 'sangli', 9370950000, 'state bank of india sangli', 'idbi00s059', 122110400008311, 1, 7010101, '', 'cow'],
  [499, 'Raj', 'ABC XYZ', 'sangli', 9370950000, 'state bank of india sangli', 'idbi00s059', 122110400008312, 1, 7010101, '', 'buff'],
];

export async function downloadFarmerSample(): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([[...SAMPLE_COLUMNS], ...SAMPLE_ROWS]);
  ws['!cols'] = [10, 20, 20, 20, 16, 28, 16, 20, 14, 14, 16, 12].map((wch) => ({ wch }));
  SAMPLE_ROWS.forEach((row, r) => row.forEach((v, c) => {
    if (typeof v !== 'number') return;
    const cell = ws[XLSX.utils.encode_cell({ r: r + 1, c })];
    if (cell) cell.z = '0';
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Sheet2');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Sheet3');
  XLSX.writeFile(wb, excelFileName('FarmerAccount_Sample'), { compression: true });
}
