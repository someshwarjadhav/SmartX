import { FileSpreadsheet, FileText, Printer, Table2 } from 'lucide-react';
import type { ExportAction } from './ExportBar';
import { exportCSV, exportExcel, exportLegacyExcel, exportPDF, printTable, type ExportTable } from '../../lib/exporters';

interface Options {
  /** builds the table (columns, rows, totals) for the current filters */
  build: () => ExportTable;
  /** number of rows shown in the toast */
  count: number;
  /** word used in the toast: "entries", "rows"... */
  unit?: string;
  toast: (message: string) => void;
  /** adds the old .xls button (Farmer Collection only) */
  legacyExcel?: boolean;
  /** leave a button out */
  without?: Array<'excel' | 'pdf' | 'print' | 'csv'>;
}


export function reportActions({ build, count, unit = 'rows', toast, legacyExcel, without = [] }: Options): ExportAction[] {
  const go = (done: string, run: (t: ExportTable) => void | Promise<void>) => async () => {
    try {
      await run(build());
      toast(done.replace('{n}', `${count} ${unit}`));
    } catch {
      toast('Export failed. Please try again.');
    }
  };

  const all: Array<ExportAction & { key: 'excel' | 'pdf' | 'print' | 'csv' }> = [
    ...(legacyExcel ? [{ key: 'excel' as const, id: 'old', label: 'Old Excel Export', icon: FileSpreadsheet, variant: 'primary' as const, run: go('Exported {n} as Old Excel', exportLegacyExcel) }] : []),
    { key: 'excel', id: 'excel', label: legacyExcel ? 'New Excel Export' : 'Excel Export', icon: FileSpreadsheet, variant: 'primary', run: go('Exported {n} as Excel', exportExcel) },
    { key: 'pdf', id: 'pdf', label: 'PDF Export', icon: FileText, variant: 'danger', run: go('Exported {n} as PDF', exportPDF) },
    { key: 'print', id: 'print', label: 'Print', icon: Printer, variant: 'outline', run: go('Print preview opened for {n}', printTable) },
    { key: 'csv', id: 'csv', label: 'CSV Export', icon: Table2, variant: 'success', run: go('Exported {n} as CSV', exportCSV) },
  ];
  return all.filter((a) => !without.includes(a.key)).map(({ key: _key, ...action }) => action);
}
