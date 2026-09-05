// The one module in the tree that asks the platform for a locale. A guard in
// src/toolchain.test.ts fails if a second module grows a constructor of its own.

/**
 * One instance per tag, held for the module's lifetime. A collator built inside
 * a comparison would be roughly eight hundred thousand of them for one sort of
 * the full dataset. Keyed by tag, so the ceiling is the catalog count.
 */
const collators = new Map<string, Intl.Collator>();
const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();
const listFormats = new Map<string, Intl.ListFormat>();

/** The one lookup the four below share. Absence, not truthiness. */
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
 * The formatter every multi-valued cell is joined by, so no component and no
 * column builder writes a separator of its own.
 */
export function listFormatFor(tag: string): Intl.ListFormat {
  return cached(listFormats, tag, (forTag) => new Intl.ListFormat(forTag));
}

/** Over the categories the tag reports, not a singular-or-other pair. */
export function selectPlural<Category extends Intl.LDMLPluralRule>(
  tag: string,
  count: number,
  forms: Readonly<Record<Category, string>>,
): string {
  return forms[pluralRulesFor(tag).select(count) as Category];
}
