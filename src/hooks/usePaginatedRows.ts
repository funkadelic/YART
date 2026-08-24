import { useMemo } from "react";

import { paginate, type PaginateResult } from "../components/paginate";

export function usePaginatedRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): PaginateResult<T> {
  return useMemo(() => paginate(rows, page, pageSize), [rows, page, pageSize]);
}
