/** Nothing to order by. Zero is not blank (0 population sorts small); NaN is. */
function isBlank(value: unknown): boolean {
  return (
    value === "" || value === null || value === undefined || Number.isNaN(value)
  );
}

/** Grouping by type keeps the comparison transitive over mixed rows. */
const TYPE_RANK = { number: 0, string: 1, other: 2 } as const;

/**
 * Places a value in the ordering above. The parse boundary types every City
 * field, so only a row type other than City reaches the mixed arms.
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
    // Compared rather than subtracted: two infinities of the same sign subtract
    // to NaN, which would skip the sort module's identity tiebreak.
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
