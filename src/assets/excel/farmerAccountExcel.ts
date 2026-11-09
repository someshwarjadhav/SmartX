import { loadXlsx } from './exporters';
import { excelFileName } from './fileName';

/**
 * Farmer Master Excel = the FarmerAccount.xlsx layout:
 *   Sheet1 (data) / Sheet2 / Sheet3 (empty), header on row 1, one row per farmer, 12 columns:
 *   farmerid | farmername | nameinbank | farmeraddress | farmercontact | farmerbank | bankifsccode | farmerbankac | farmerstatus | villageid | farmeraadhaar | farmercow
 * Same column widths as the sample. Numbers (farmer id, contact, account, status, village id, aadhaar) are REAL numbers,
 * so selecting a column in Excel shows its Sum. A value that cannot be a number without losing digits (more than
 * 15 digits, or leading zeros) stays text.
 */
export const FARMER_ACCOUNT_HEAD = [
  'farmerid',
  'farmername',
  'nameinbank',
  'farmeraddress',
  'farmercontact',
  'farmerbank',
  'bankifsccode',
  'farmerbankac',
  'farmerstatus',
  'villageid',
  'farmeraadhaar',
  'farmercow',
] as const;

// column widths of FarmerAccount.xlsx (A ... L); K keeps the default width
const WIDTHS = [23.55, 36.89, 23.44, 17.33, 21.89, 25, 22.55, 27.33, 27, 25.55, 9, 15.22];

export interface FarmerAccountRow {
  farmerId: string | number;
  name: string;
  nameInBank: string;
  address: string;
  mobile: string;
  bank: string;
  ifsc: string;
  account: string;
  active: boolean;
  /** the village / centre id as the screen shows it */
  villageId: string;
  aadhaar: string;
  cow?: string;
}

/** a number when the text is plain digits that Excel can hold exactly, else the text itself ('' stays empty) */
const numeric = (v: string | number | undefined): string | number => {
  const t = String(v ?? '').trim();
  if (t === '') return '';
  return /^(0|[1-9]\d{0,14})$/.test(t) ? Number(t) : t;
};

export async function exportFarmerAccountExcel(rows: FarmerAccountRow[], fileName: string): Promise<void> {
  const XLSX = await loadXlsx();
  const aoa: Array<Array<string | number>> = [
    [...FARMER_ACCOUNT_HEAD],
    ...rows.map((r): Array<string | number> => [
      numeric(r.farmerId),
      r.name,
      r.nameInBank,
      r.address,
      numeric(r.mobile),
      r.bank,
      r.ifsc,
      numeric(r.account),
      r.active ? 1 : 0,
      numeric(r.villageId),
      numeric(r.aadhaar),
      r.cow ?? '',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = WIDTHS.map((wch) => ({ wch }));
  // whole numbers are shown as they are (no thousands comma, no 9.37E+09)
  aoa.forEach((row, r) => {
    if (r === 0) return;
    row.forEach((v, c) => {
      if (typeof v !== 'number') return;
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = '0';
    });
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Sheet2');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Sheet3');
  XLSX.writeFile(wb, excelFileName(fileName), { compression: true });
}
