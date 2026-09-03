import { useMemo } from "react";

import { paginate, type PaginateResult } from "../components/paginate";

/** Memoizes one page. The clamped position is to render, never to store. */
export function usePaginatedRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): PaginateResult<T> {
  return useMemo(() => paginate(rows, page, pageSize), [rows, page, pageSize]);
}
