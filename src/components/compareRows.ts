/** Nothing to order by. Zero is not blank, it sorts small; NaN is blank. */
function isBlank(value: unknown): boolean {
  return (
    value === "" || value === null || value === undefined || Number.isNaN(value)
  );
}

/** Grouping by type keeps the comparison transitive over mixed rows. */
const TYPE_RANK = { number: 0, string: 1, other: 2 } as const;

/**
 * Places a value in the ordering above.
 *
 * No shipped column reaches the `other` rank today: every column whose field is
 * neither a number nor a string supplies its own comparator. A column that did
 * not would land here, and an array would then compare by `String(array)`, which
 * is not the order any reader expects. An empty array is not blank by the test
 * above either, so such a column would sort its empty lists among the letters
 * instead of last. The arm stays for that case and is covered directly.
 */
function rank(value: unknown): number {
  if (typeof value === "number") return TYPE_RANK.number;
  if (typeof value === "string") return TYPE_RANK.string;
  return TYPE_RANK.other;
}

/** Orders two present values. Type is the primary key, so no pair cycles. */
function compareRanked(
  aValue: unknown,
  bValue: unknown,
  collator: Intl.Collator,
): number {
  const aRank = rank(aValue);
  const bRank = rank(bValue);
  if (aRank !== bRank) return aRank - bRank;

  if (aRank === TYPE_RANK.number) {
    // Subtracting two infinities of the same sign gives NaN, which would skip
    // the sort module's identity tiebreak, so these are compared instead.
    const aNumber = aValue as number;
    const bNumber = bValue as number;
    if (aNumber === bNumber) return 0;
    return aNumber < bNumber ? -1 : 1;
  }

  return collator.compare(String(aValue), String(bValue));
}

/**
 * Orders two already-widened values. Blanks are tested ahead of the direction
 * flip so they stay last either way, and the collator is a parameter because
 * this layer may not import the locale layer.
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

  // Both blank compares equal; the arm above answered every one-sided pair.
  const comparison = aBlank ? 0 : compareRanked(aValue, bValue, collator);

  // Returned ahead of the flip so an equal pair is a positive zero either way.
  // Negating zero gives -0, which an equality check downstream reads as unequal.
  if (comparison === 0) return 0;
  return direction === "desc" ? -comparison : comparison;
}
