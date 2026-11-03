import type * as React from 'react';
import { PAGE_SIZES } from '../../hooks/usePagination';
import { Select } from './Select';

interface Props {
  from: number;
  to: number;
  total: number;
  pageSize: number;
  onPageSize: (size: number) => void;
  sizes?: number[];
  sizeLabel?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

export const TableToolbar: React.FC<Props> = ({ from, to, total, pageSize, onPageSize, sizes = PAGE_SIZES, sizeLabel = 'Result', filters, actions }) => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line bg-soft/50 px-4 py-3 sm:px-5">
    <p className="tnum text-sm text-mute">
      <span className="font-bold text-ink">Record Count:</span> {from} - {to} of {total}
    </p>
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold">{sizeLabel}:</span>
      <Select
        label={sizeLabel}
        value={String(pageSize)}
        onChange={(v) => onPageSize(Number(v))}
        options={sizes.map((s) => ({ value: String(s), label: String(s) }))}
        className="w-24"
      />
    </div>
    {filters}
    {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto lg:ml-auto">{actions}</div>}
  </div>
);
