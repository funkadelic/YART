import type { Column } from "./column";

/**
 * Orders rows by one column, or hands them back untouched when nothing is
 * sorted.
 *
 * The identity tiebreak lives here rather than inside a column's comparator
 * because the function that produces a row's identity is a table-level prop:
 * a column is defined without knowing what identifies a row, and this is the
 * first place both are in scope at once. It runs after the column comparator
 * has had its say, and it is never flipped by the direction, which keeps it one
 * rule a reader can state in a line rather than a rule with an exception. It is
 * also what makes sorting the same set twice produce the same order, rather
 * than whichever order the rows happened to arrive in.
 */
export function sortRows<T, Id extends string>(
  rows: readonly T[],
  column: Column<T, Id> | undefined,
  direction: "asc" | "desc" | null,
  getRowId: (row: T) => string,
): readonly T[] {
  if (!column || !direction) return rows;

  // The resolved collection is module-cached and shared by every reader, so
  // it is treated as immutable and the sort runs over a copy.
  return [...rows].sort((a, b) => {
    const comparison = column.compare(a, b, direction);
    if (comparison !== 0) return comparison;

    // Identities order as text, so an identity of "100" comes before "99".
    // That is accepted rather than overlooked: this line only ever decides a
    // pair whose column values already compare equal, so no ordering a reader
    // can see is affected, and the alternative is a second ordering rule that
    // has to be held and tested alongside the one above.
    const aId = getRowId(a);
    const bId = getRowId(b);
    if (aId === bId) return 0;
    return aId < bId ? -1 : 1;
  });
}
