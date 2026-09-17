import type { Column } from "./column";
import { sortRows } from "./sortRows";

/** One stored sort: its input, the order it produced, and its row identity. */
interface Entry {
  readonly input: readonly unknown[];
  readonly sorted: readonly unknown[];
  readonly getRowId: unknown;
}

/**
 * The last sort per column object and direction. Weak, so a rebuilt column
 * array releases its entries.
 *
 * ponytail: one sorted array retained per column and direction sorted, and the
 * first sort of each still compares every row; yield in that pass to upgrade.
 */
const CACHE = new WeakMap<object, { asc?: Entry; desc?: Entry }>();

/**
 * Same result as `sortRows`, reusing the last order for that column and
 * direction when it covers the rows. Keyed on the column object, which the
 * container rebuilds on a locale change, so no locale serves another's order.
 */
export function sortRowsCached<T, Id extends string>(
  rows: readonly T[],
  column: Column<T, Id> | undefined,
  direction: "asc" | "desc" | null,
  getRowId: (row: T) => string,
): readonly T[] {
  if (!column || !direction) return rows;

  let record = CACHE.get(column);
  const entry = record?.[direction];

  if (entry?.getRowId === getRowId) {
    if (rows === entry.input) return entry.sorted as readonly T[];

    // A strict total order restricted to a subset is that subset's sort.
    // Delete, not has: each row is taken at most once, so repeats cannot match.
    const remaining = new Set<unknown>(rows);
    const restricted = entry.sorted.filter((row) => remaining.delete(row));
    if (restricted.length === rows.length) return restricted as readonly T[];
  }

  const sorted = sortRows(rows, column, direction, getRowId);
  if (!record) {
    record = {};
    CACHE.set(column, record);
  }
  record[direction] = { input: rows, sorted, getRowId };
  return sorted;
}
