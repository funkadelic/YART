import { en, type Catalog, type SortedDirection } from "./en";

/**
 * The right-to-left pseudo-locale.
 *
 * Not a language. It exists so direction and truncation have something to prove
 * themselves against, because the three catalogs beside it are all left to
 * right and would leave both untestable.
 *
 * A deliberate hybrid of the two pseudo-locales the browsers already ship: the
 * direction comes from the right-to-left one, the readability and the padding
 * come from the left-to-right one. The character reversal the real right-to-left
 * pseudo-locale performs is dropped on purpose, and dropping it is the point
 * rather than an omission: anyone reading this repository has to be able to read
 * this catalog, which is the whole reason it was taken over shipping Arabic
 * strings nobody here can review.
 *
 * Every entry is derived from the corresponding entry of the base catalog rather
 * than committed as a transformed literal, so this file cannot drift from the
 * copy it pseudo-translates.
 *
 * This file contains bidirectional control characters by design. Review tooling
 * that flags them is firing correctly, and this is the one file in the tree
 * where they belong.
 */

/**
 * Opens a run whose direction is taken from its first strongly directional
 * character, so a Latin string renders as its own left-to-right run inside a
 * right-to-left document instead of having its punctuation scattered.
 *
 * An isolate rather than a directional mark, because a mark states a direction
 * at a point and cannot bound a run.
 */
const FIRST_STRONG_ISOLATE = "⁦";

/** Closes the run the isolate above opened. */
const POP_DIRECTIONAL_ISOLATE = "⁩";

/** What the padding is made of. Visibly filler, so nobody reads it as copy. */
const PADDING_CHARACTER = "~";

/**
 * One message, pseudo-translated.
 *
 * Three things at once, each catching a different defect. The brackets bound the
 * message unit, so a sentence assembled out of two catalog entries shows up as
 * two bracketed units rather than as one plausible line. The isolates keep the
 * readable run readable inside a right-to-left document. The padding grows the
 * string by roughly a third, which is about what a real translation costs, so a
 * layout that truncates or overflows does it here rather than in front of a
 * reader.
 */
export function pseudoize(message: string): string {
  const padding = PADDING_CHARACTER.repeat(Math.ceil(message.length / 3));

  return `[${FIRST_STRONG_ISOLATE}${message}${POP_DIRECTIONAL_ISOLATE} ${padding}]`;
}

/**
 * The pseudo-locale catalog. Every function-valued entry pseudo-translates the
 * base catalog's result rather than a template, so the values woven into a
 * sentence land inside the brackets where a truncation would cut them.
 *
 * It declares no plural nouns of its own, and that is not an omission. Its
 * strings really are English and its resolved tag really is the English one, so
 * the base catalog's two categories are its two categories, and a second set
 * here could only ever drift from them.
 */
export const pseudo = {
  columnName: pseudoize(en.columnName),
  columnCountry: pseudoize(en.columnCountry),
  columnCapital: pseudoize(en.columnCapital),
  columnCountryCode: pseudoize(en.columnCountryCode),
  columnPopulation: pseudoize(en.columnPopulation),
  loading: pseudoize(en.loading),
  empty: pseudoize(en.empty),
  emptyAnnouncement: pseudoize(en.emptyAnnouncement),
  results: (tag: string, shown: number, total: number) =>
    pseudoize(en.results(tag, shown, total)),
  caption: (tag: string, total: number, sortSummary: string) =>
    pseudoize(en.caption(tag, total, sortSummary)),
  error: (message: string) => pseudoize(en.error(message)),
  retry: pseudoize(en.retry),
  sortedAnnouncement: (columnLabel: string, direction: SortedDirection) =>
    pseudoize(en.sortedAnnouncement(columnLabel, direction)),
  sortClearedAnnouncement: pseudoize(en.sortClearedAnnouncement),
  unsorted: pseudoize(en.unsorted),
  sortSummary: (columnLabel: string, direction: SortedDirection) =>
    pseudoize(en.sortSummary(columnLabel, direction)),
  pageSize: pseudoize(en.pageSize),
  paginationNavigation: pseudoize(en.paginationNavigation),
  firstPage: pseudoize(en.firstPage),
  previousPage: pseudoize(en.previousPage),
  nextPage: pseudoize(en.nextPage),
  lastPage: pseudoize(en.lastPage),
  searchName: pseudoize(en.searchName),
  searchPlaceholder: pseudoize(en.searchPlaceholder),
  pageStatus: (tag: string, page: number, totalPages: number) =>
    pseudoize(en.pageStatus(tag, page, totalPages)),
} satisfies Catalog;
