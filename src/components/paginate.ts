/** One page read out of a collection: rows, page count, page actually read. */
export interface PaginateResult<T> {
  readonly paginatedData: readonly T[];
  readonly totalPages: number;
  readonly effectivePage: number;
}

/** Slices one page. The position is an argument; the clamp stays here. */
export function paginate<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): PaginateResult<T> {
  // Floored at one, because zero would be a page count nothing can be on.
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  // Clamped for reading only. The position in state is left alone, so a result
  // set that widens again restores the reader where they were.
  const effectivePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (effectivePage - 1) * pageSize;
  return {
    paginatedData: rows.slice(startIndex, startIndex + pageSize),
    totalPages,
    effectivePage,
  };
}
