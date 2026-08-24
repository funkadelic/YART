import { useMemo } from "react";

import { paginate, type PaginateResult } from "../components/paginate";

/**
 * Memoizes one page of rows.
 *
 * The page position it reports back has been clamped to the number of pages
 * that exist, which is a value to render and never one to write back into
 * state: storing it would strand the user on whatever a narrowed result set
 * allowed rather than restoring them when it widens again.
 */
export function usePaginatedRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): PaginateResult<T> {
  return useMemo(() => paginate(rows, page, pageSize), [rows, page, pageSize]);
}
