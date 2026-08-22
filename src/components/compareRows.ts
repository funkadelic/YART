import type { City } from "../api/getCities";

/**
 * One collator for the module's lifetime. Building one inside the comparison
 * would build roughly eight hundred thousand of them for a single sort of the
 * full dataset, which is the cost this replaces. No locale and no options are
 * supplied, so the ordering stays exactly the one the per-call comparison
 * already produced: fixing what a comparison costs is not a licence to change
 * what it decides.
 */
const COLLATOR = new Intl.Collator();

/**
 * A value carrying nothing to order by. A zero is deliberately not blank; the
 * dataset records hundreds of cities with no population as 0, and those rows
 * belong at the small end of a population sort rather than at the far end with
 * the empty strings.
 */
function isBlank(value: unknown): boolean {
  return value === "" || value === null || value === undefined;
}

/**
 * Orders two rows by one column.
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
 * direction flip touches. Pairings the two fast paths do not recognise still
 * get a defined order rather than zero. The parse boundary guarantees each
 * field's type today, so the dataset cannot reach those arms; they are here for
 * the point at which the table becomes generic over its row type and that
 * guarantee stops covering the input.
 *
 * The row-id tiebreak runs last and is never flipped, which keeps it one rule a
 * reader can state in a line instead of a rule with an exception. It is also
 * what makes sorting the same set twice produce the same order, rather than
 * whichever order the rows happened to arrive in.
 */
export function compareRows(
  a: City,
  b: City,
  column: keyof City,
  direction: "asc" | "desc",
): number {
  // Widened rather than asserted. City declares no nullable field and no field
  // that is sometimes text and sometimes a number, so against the declared
  // types the defensive arms below are branches the compiler would reject.
  const aValue: unknown = a[column];
  const bValue: unknown = b[column];

  const aBlank = isBlank(aValue);
  const bBlank = isBlank(bValue);
  if (aBlank !== bBlank) return aBlank ? 1 : -1;

  let comparison = 0;
  if (!aBlank) {
    if (typeof aValue === "string" && typeof bValue === "string") {
      comparison = COLLATOR.compare(aValue, bValue);
    } else if (typeof aValue === "number" && typeof bValue === "number") {
      comparison = aValue - bValue;
    } else {
      comparison = COLLATOR.compare(String(aValue), String(bValue));
    }
  }

  const directed = direction === "desc" ? -comparison : comparison;
  return directed !== 0 ? directed : a.id - b.id;
}
