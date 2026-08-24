/**
 * One page read out of a collection: the rows on that page, how many pages the
 * collection has, and which page was actually read.
 */
export interface PaginateResult<T> {
  readonly paginatedData: readonly T[];
  readonly totalPages: number;
  readonly effectivePage: number;
}

/**
 * Slices one page out of a collection.
 *
 * The page position is an argument rather than something this function owns,
 * and the correction it applies below never leaves this function, which is what
 * lets a position arrive from anywhere: a click, a restored URL, or a render
 * that happens before the rows do.
 */
export function paginate<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): PaginateResult<T> {
  // Floored at one so an empty result set still counts as a single page.
  // Zero would be a page count nothing can be on, and callers outside the
  // navigation's own visibility guard have no protection from it.
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  // Clamped for reading only. The position held in state is deliberately
  // left alone, so a result set that widens again restores the user where
  // they were rather than stranding them on whatever the narrowed set
  // allowed, and so a position arriving from outside survives a fetch that
  // has not resolved yet.
  const effectivePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (effectivePage - 1) * pageSize;
  return {
    paginatedData: rows.slice(startIndex, startIndex + pageSize),
    totalPages,
    effectivePage,
  };
}
