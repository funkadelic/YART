import { numberFormatFor, selectPlural } from "../format";

/**
 * The nouns the two woven sentences below pluralize, one record per noun,
 * total over the two categories the English tag reports.
 *
 * Total rather than defaulted, so there is no fallback arm here that nothing
 * can reach and no branch the coverage gate cannot cover. The category set is
 * CLDR data rather than a type, so what holds these honest is the catalog test,
 * which calls every catalog with a count drawn from each of its own tag's
 * categories and reads the result for a hole.
 */
const CITY = { one: "city", other: "cities" };
const RESULT = { one: "result", other: "results" };
const ENTRY = { one: "entry", other: "entries" };

/**
 * The base catalog: every string the shared table renders that names what its
 * rows are, in the language the rest of the tree is checked against.
 *
 * The wording is the wording the table already shipped, up to the two nouns
 * that now follow their count and the two counts that are now grouped.
 *
 * The two function-valued entries take the resolved language tag as their first
 * parameter, and that parameter is the whole reason they are functions rather
 * than templates: the count a reader sees is grouped by the tag's own rule, and
 * the noun beside it is selected over the categories the tag reports. Neither
 * decision can be made where the sentence is assembled, because that is one
 * layer below the locale by construction.
 */
export const en = {
  loading: "Downloading the city data...",
  empty: "No cities found",
  emptyAnnouncement: "No cities found for that search",
  results: (tag: string, shown: number, total: number) => {
    const number = numberFormatFor(tag);

    return `Showing ${number.format(shown)} ${selectPlural(tag, shown, CITY)} out of ${number.format(total)} total ${selectPlural(tag, total, RESULT)}`;
  },
  caption: (tag: string, total: number, sortSummary: string) =>
    `City data with ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTRY)}, currently ${sortSummary}`,
};

/**
 * The shape every other catalog is held to. Derived from the base rather than
 * declared beside it, so the key set has one definition: a catalog missing a key
 * or misspelling one fails the type check rather than rendering undefined at a
 * reader.
 */
export type Catalog = typeof en;
