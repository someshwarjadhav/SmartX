import { useCallback, useMemo, useState } from 'react';

export const PAGE_SIZES = [10, 50, 100];
export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0] ?? 10;

export function usePagination<T>(items: T[], initialSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setSize] = useState(initialSize);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const visible = useMemo(() => items.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize]);

  const goTo = useCallback((p: number) => setPage(Math.max(1, p)), []);
  const reset = useCallback(() => setPage(1), []);
  const setPageSize = useCallback((s: number) => {
    setSize(s);
    setPage(1);
  }, []);

  return {
    page: current,
    pageSize,
    pageCount,
    total,
    visible,
    from: total === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(total, current * pageSize),
    goTo,
    reset,
    setPageSize,
  };
}
