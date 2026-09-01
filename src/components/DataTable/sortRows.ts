import type { Column } from "./column";

/**
 * Orders rows by one column. Row identity is a table-level prop, so the
 * tiebreak lives here rather than inside a column's comparator.
 */
export function sortRows<T, Id extends string>(
  rows: readonly T[],
  column: Column<T, Id> | undefined,
  direction: "asc" | "desc" | null,
  getRowId: (row: T) => string,
): readonly T[] {
  if (!column || !direction) return rows;

  // The resolved collection is module-cached and shared, so it is treated as
  // immutable and the sort runs over a copy.
  return [...rows].sort((a, b) => {
    const comparison = column.compare(a, b, direction);
    if (comparison !== 0) return comparison;

    return compareIdentities(getRowId(a), getRowId(b));
  });
}

/**
 * Ascending, never flipped, and never collated: an identity is not a value the
 * reader sees, so collating it would give two readers two orders.
 */
export function compareIdentities(aId: string, bId: string): number {
  if (aId === bId) return 0;
  return aId < bId ? -1 : 1;
}
