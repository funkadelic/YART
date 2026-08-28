// The one module in the tree that asks the platform for a locale. Every
// locale-sensitive decision the application makes reaches a constructor here,
// keyed by the resolved tag, and a guard in src/toolchain.test.ts fails if a
// second module grows one of its own.

/**
 * One instance per tag, held for the module's lifetime.
 *
 * The reasoning moved here from the single module-scope collator this replaces,
 * and it survives the move intact: building a collator inside the comparison
 * would build roughly eight hundred thousand of them for a single sort of the
 * full dataset. The value formatter has the same shape of cost one layer up,
 * because the platform's per-value formatting helper builds a formatter on
 * every call, which is one per rendered cell per render.
 *
 * What changed is that the instance can no longer be a constant: it is a
 * function of the resolved tag, and the tag moves when the reader chooses. A
 * map keyed by tag is what keeps one instance per locale rather than one
 * instance per document, and it is a cache with a known ceiling rather than one
 * that grows with input, because the only keys reaching it are the tags of a
 * four-entry frozen record.
 */
const collators = new Map<string, Intl.Collator>();
const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

/**
 * The one lookup the three below share, written once rather than three times.
 * Absence is tested rather than truthiness because the value is an object and
 * the map holds no falsy ones, so the two would agree today and diverge the
 * first time something cacheable is not.
 */
function cached<T>(
  cache: Map<string, T>,
  tag: string,
  build: (tag: string) => T,
): T {
  let found = cache.get(tag);

  if (found === undefined) {
    found = build(tag);
    cache.set(tag, found);
  }

  return found;
}

/** The collator every text comparison in the tree orders with. */
export function collatorFor(tag: string): Intl.Collator {
  return cached(collators, tag, (forTag) => new Intl.Collator(forTag));
}

/** The formatter every count a reader sees is grouped by. */
export function numberFormatFor(tag: string): Intl.NumberFormat {
  return cached(numberFormats, tag, (forTag) => new Intl.NumberFormat(forTag));
}

/** The rules every plural noun in a catalog is selected over. */
export function pluralRulesFor(tag: string): Intl.PluralRules {
  return cached(pluralRules, tag, (forTag) => new Intl.PluralRules(forTag));
}

/**
 * Picks a noun's form for a count, over the categories the tag itself reports
 * rather than over a singular-or-other pair.
 *
 * The pair is wrong in half the catalogs that ship: Spanish and French each
 * report three categories where English reports two, and French puts zero in
 * the singular where the other two put it in the plural. A ternary on the count
 * cannot express either of those, and would be silently wrong rather than
 * visibly missing.
 *
 * The assertion on the selected category is the one place in this module where
 * the platform's answer is narrowed to what the caller declared, and it is
 * sound exactly while a caller's record is total over the categories its own
 * tag reports. Nothing in the type system can check that, because the category
 * set is CLDR data rather than a type, so the catalog test asserts it directly:
 * every catalog is called with a count drawn from each of its tag's categories
 * and its sentences are read for a hole.
 */
export function selectPlural<Category extends Intl.LDMLPluralRule>(
  tag: string,
  count: number,
  forms: Readonly<Record<Category, string>>,
): string {
  return forms[pluralRulesFor(tag).select(count) as Category];
}
