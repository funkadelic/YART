import type { Column } from "./column";

/** Row identity is a table-level prop, so the tiebreak lives here. */
export function sortRows<T, Id extends string>(
  rows: readonly T[],
  column: Column<T, Id> | undefined,
  direction: "asc" | "desc" | null,
  getRowId: (row: T) => string,
): readonly T[] {
  if (!column || !direction) return rows;

  // The resolved collection is module-cached and shared, so it is treated as
  // immutable and the sort runs over a copy.
  return [...rows].sort(rowComparator(column, direction, getRowId));
}

/** The column's comparison, then the identity tiebreak: a strict total order. */
export function rowComparator<T, Id extends string>(
  column: Column<T, Id>,
  direction: "asc" | "desc",
  getRowId: (row: T) => string,
): (a: T, b: T) => number {
  return (a, b) => {
    const comparison = column.compare(a, b, direction);
    if (comparison !== 0) return comparison;

    return compareIdentities(getRowId(a), getRowId(b));
  };
}

/** An identity is not a visible value, so it is never flipped or collated. */
export function compareIdentities(aId: string, bId: string): number {
  if (aId === bId) return 0;
  return aId < bId ? -1 : 1;
}
