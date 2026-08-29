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
 *
 * What that tiebreak decides, and what the caller owes it, is on
 * compareIdentities below.
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

    return compareIdentities(getRowId(a), getRowId(b));
  });
}

/**
 * Orders two row identities, ascending and never flipped by the direction.
 *
 * Identities order as text, so an identity of "100" comes before "99". That is
 * a real ordering a reader can see, not a detail below the surface: it decides
 * every pair whose column values compare equal, and a column with many equal
 * values leaves most of the table to this rule. Supplying identities that sort
 * as text the way their subjects sort is therefore the caller's job, and the
 * caller is the only one who knows what a row's identity means.
 *
 * Deliberately not collated, and that is the one thing to keep true here. The
 * column comparator above orders text by the reader's resolved locale, which is
 * what a reader expects of the values they can see. An identity is not a value
 * they can see: it decides every pair the column left tied, so collating it
 * would let the same data come out in two orders for two readers with every
 * visible value equal. Ordering identities as plain text is what keeps that one
 * rule the same for everyone.
 *
 * Exported so a caller reproducing the table's order compares identities the
 * way the table does, rather than restating the rule and drifting from it.
 */
export function compareIdentities(aId: string, bId: string): number {
  if (aId === bId) return 0;
  return aId < bId ? -1 : 1;
}
