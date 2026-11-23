import { FileSpreadsheet, FileText, Printer, Table2 } from 'lucide-react';
import type { ExportAction } from './ExportBar';
import type { ToastTone } from './Toast';
import { MSG } from '../../lib/messages';
import { exportCSV, exportExcel, exportPDF, exportPlainExcel, printTable, type ExportTable } from '../../assets/excel/exporters';

interface Options {
  /** builds the table (columns, rows, totals) for the current filters */
  build: () => ExportTable;
  /** number of rows shown in the toast */
  count: number;
  /** word used in the toast: "entries", "rows"... */
  unit?: string;
  toast: (message: string, tone?: ToastTone) => void;
  /**
   * Farmer Collection: ONE "Excel Export" button whose sheet is chosen by the caller from the plant excel version
   * (1 = normal, 2 = Athare layout, 3 = Bansi layout - see FarmerCollection.tsx). Returns the STIPL-style sheet to download.
   */
  versionExcel?: () => ExportTable;
  /** leave a button out */
  without?: Array<'excel' | 'pdf' | 'print' | 'csv'>;
}

export function reportActions({ build, count, unit = 'rows', toast, versionExcel, without = [] }: Options): ExportAction[] {
  const go = (done: string, run: (t: ExportTable) => void | Promise<void>, builder: () => ExportTable = build) => async () => {
    try {
      await run(builder());
      toast(done.replace('{n}', `${count} ${unit}`), 'ok');
    } catch {
      toast(MSG.exportFailed, 'error');
    }
  };

  const all: Array<ExportAction & { key: 'excel' | 'pdf' | 'print' | 'csv' }> = [
    versionExcel
      ? { key: 'excel' as const, id: 'excel', label: 'Excel Export', icon: FileSpreadsheet, variant: 'primary' as const, run: go('Exported {n} as Excel', exportPlainExcel, versionExcel) }
      : { key: 'excel' as const, id: 'excel', label: 'Excel Export', icon: FileSpreadsheet, variant: 'primary' as const, run: go('Exported {n} as Excel', exportExcel) },
    { key: 'pdf', id: 'pdf', label: 'PDF Export', icon: FileText, variant: 'danger', run: go('Exported {n} as PDF', exportPDF) },
    { key: 'print', id: 'print', label: 'Print', icon: Printer, variant: 'outline', run: go('Print preview opened for {n}', printTable) },
    { key: 'csv', id: 'csv', label: 'CSV Export', icon: Table2, variant: 'success', run: go('Exported {n} as CSV', exportCSV) },
  ];
  return all.filter((a) => !without.includes(a.key)).map(({ key: _key, ...action }) => action);
}
