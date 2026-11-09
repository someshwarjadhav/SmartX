import type * as React from 'react';
import { PageBar } from './PageBar';

interface Props {
  total: number;
  page: number;
  size: number;
  onPage: (page: number) => void;
  /** The "Result per page" picker now sits in the bar above the table (ReportBar `pager`), so this is optional. */
  onSize?: (size: number) => void;
  /** Kept for old callers. Every table now offers 100 / 200 / 300 rows. */
  sizes?: number[];
  sizeLabel?: string;
}

export const ReportPager: React.FC<Props> = ({ total, page, size, onPage, onSize }) => (
  <PageBar total={total} page={page} size={size} onPage={onPage} onSize={onSize} />
);
