import type * as React from "react";
import { PageBar } from "./PageBar";

interface Props {
  total: number;
  page: number;
  size: number;
  onPage: (page: number) => void;
  onSize?: (size: number) => void;
  /** Kept for old callers. Every table now offers 10 / 50 / 100 rows. */
  sizes?: number[];
  className?: string;
}

export const Pager: React.FC<Props> = ({ total, page, size, onPage, onSize, className }) => (
  <PageBar total={total} page={page} size={size} onPage={onPage} onSize={onSize} className={className} />
);
