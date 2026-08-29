/**
 * A value carrying nothing to order by. A zero is deliberately not blank; the
 * dataset records hundreds of cities with no population as 0, and those rows
 * belong at the small end of a population sort rather than at the far end with
 * the empty strings.
 *
 * NaN is blank. It is a number by typeof, so without this it reaches the
 * subtraction and returns NaN, which is neither negative, positive, nor zero:
 * the direction flip leaves it NaN, the row-id tiebreak never runs, and the
 * order of a set holding one comes out different for different arrival orders.
 */
function isBlank(value: unknown): boolean {
  return (
    value === "" || value === null || value === undefined || Number.isNaN(value)
  );
}

/**
 * Where a value's type sits in the ordering. Grouping by type before comparing
 * within it is what keeps the comparison transitive once the rows stop being
 * uniformly typed: numbers order among themselves, everything else collates as
 * text, and the two groups never have to be compared by a rule that disagrees
 * with the rule used inside them.
 */
const TYPE_RANK = { number: 0, string: 1, other: 2 } as const;

/**
 * Places one value in the ordering above, dispatching on its runtime type
 * because the rows reach here already widened and a declared type is not
 * available to dispatch on.
 */
function rank(value: unknown): number {
  if (typeof value === "number") return TYPE_RANK.number;
  if (typeof value === "string") return TYPE_RANK.string;
  return TYPE_RANK.other;
}

/**
 * Orders two values that are both present, before any direction is applied.
 *
 * Type is the primary key, so which rule decides a pair is settled by the pair's
 * types rather than by the values: without that, a numeric pair and a
 * stringified pair can each be decided by a different rule and produce a cycle.
 */
function compareRanked(
  aValue: unknown,
  bValue: unknown,
  collator: Intl.Collator,
): number {
  const aRank = rank(aValue);
  const bRank = rank(bValue);
  if (aRank !== bRank) return aRank - bRank;

  if (aRank === TYPE_RANK.number) {
    // Compared rather than subtracted. Two infinities of the same sign subtract
    // to NaN, which would skip the identity tiebreak the sort module applies
    // after this returns and leave the order up to the sort, and a subtraction
    // of two large magnitudes reports a difference where a direction is all
    // that is wanted.
    const aNumber = aValue as number;
    const bNumber = bValue as number;
    if (aNumber === bNumber) return 0;
    return aNumber < bNumber ? -1 : 1;
  }

  return collator.compare(String(aValue), String(bValue));
}

/**
 * Orders two already-widened values.
 *
 * The three rules below compose in an order that is load-bearing, so read them
 * as a sequence rather than as a set.
 *
 * The blank test runs first, ahead of the direction flip, which is what puts
 * blanks last whichever way the column is sorted. Capital is empty on roughly
 * two thirds of the rows, so the other rule leads the first ascending page with
 * a screen of empty cells and reads as a broken table.
 *
 * The typed comparison runs second, and its result is the only thing the
 * direction flip touches. Type is the primary key there, so which rule decides
 * a pair is settled by the column rather than by the pair: without that, a
 * numeric pair and a stringified pair can each be decided by a different rule
 * and produce a cycle, which is an ordering the sort is free to resolve however
 * it likes. The parse boundary guarantees each field's type today, so the
 * dataset cannot reach the mixed arms; they are here for the point at which the
 * table becomes generic over its row type and that guarantee stops covering the
 * input.
 *
 * The row-identity tiebreak that used to run last is no longer here. It ran on
 * a field of the row, and this function no longer sees a row: identity is a
 * table-level prop, not a fact a column can know about itself. It now runs in
 * the sort module, after this function returns and never flipped, so the rule
 * itself is unchanged.
 *
 * The collator arrives as an argument, and it has no default. This module held
 * one for its own lifetime while the ordering was whatever the machine running
 * the code happened to prefer; text now collates by the reader's resolved
 * locale, so the instance is a function of that locale and cannot be a constant
 * here. A default would be the locale-less collator this parameter exists to
 * remove, and it would hide a call site from the source guard that keeps every
 * platform locale construction in one module. This layer still imports nothing
 * from the locale layer: a collator handed in is a value, not a dependency.
 */
export function compareValues(
  aValue: unknown,
  bValue: unknown,
  direction: "asc" | "desc",
  collator: Intl.Collator,
): number {
  const aBlank = isBlank(aValue);
  const bBlank = isBlank(bValue);
  if (aBlank !== bBlank) return aBlank ? 1 : -1;

  // Both blank compares equal: the arm above has already answered every pair
  // where only one of them is.
  const comparison = aBlank ? 0 : compareRanked(aValue, bValue, collator);

  // Returned ahead of the flip so an equal pair comes back as a positive zero
  // in both directions. Negating zero gives negative zero, which every ordering
  // rule downstream reads as a tie but which an equality check does not: the
  // pair would compare equal ascending and not equal descending.
  if (comparison === 0) return 0;
  return direction === "desc" ? -comparison : comparison;
}
