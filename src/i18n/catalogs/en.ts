import type { DatasetErrorCode } from "../../api/getCities";
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
 * Which way a sorted column runs.
 *
 * Declared here rather than imported from the table, because a catalog names
 * words and must not learn what a table is. It is the same pair of tokens the
 * sort state travels as, and it arrives at the two entries below as a value
 * precisely so that no sentence has to build a word out of it.
 */
export type SortedDirection = "asc" | "desc";

/**
 * The two directions, as the words the sentences below weave in.
 *
 * A record rather than a suffix appended to the token, and the difference is
 * the whole reason this file changed: "ascend" plus "ing" is a word in exactly
 * one language, and a sentence assembled that way cannot be translated at all.
 * Every language spells the pair out here and reads it by key.
 */
const DIRECTION: Readonly<Record<SortedDirection, string>> = {
  asc: "ascending",
  desc: "descending",
};

/**
 * What a reader is told when the city data cannot be loaded, one sentence per
 * failure code.
 *
 * Total over the code union rather than defaulted, so a code added to the loader
 * without a sentence in all four catalogs fails the type check instead of
 * rendering the word undefined at the moment the application has already
 * failed. There is no fallback arm here and so no branch the coverage gate
 * cannot reach.
 *
 * Every entry has the same signature and most ignore both arguments, which is
 * what keeps the lookup one call with no branch. The three that use the second
 * one weave a row index or a response status and group it on the resolved tag,
 * like every other number this application shows.
 *
 * The field count in the two row sentences is written out rather than passed
 * in. It is a fact about the asset's shape rather than a quantity a reader's
 * locale groups, and the detail slot is already carrying the row.
 */
export type DatasetErrorText = Readonly<
  Record<DatasetErrorCode, (tag: string, detail: number) => string>
>;

const DATASET_ERROR_TEXT: DatasetErrorText = {
  notAnObject: () => "The city data could not be read.",
  missingRows: () => "The city data is missing its rows array.",
  columnOrder: () =>
    "The city data has an unexpected column order and was not loaded.",
  rowShape: (tag, at) =>
    `City row ${numberFormatFor(tag).format(at)} does not have 7 fields and was not loaded.`,
  rowFieldType: (tag, at) =>
    `City row ${numberFormatFor(tag).format(at)} has a field of the wrong type and was not loaded.`,
  transport: () =>
    "The city data could not be downloaded. Check your connection and try again.",
  status: (tag, status) =>
    `The city data could not be downloaded (status ${numberFormatFor(tag).format(status)}).`,
  notJson: () => "The city data was downloaded but could not be read as JSON.",
  unexpected: () => "An unexpected error occurred",
};

/**
 * The base catalog: every string the city table shows that names what its rows
 * are or what a column of them holds, in the language the rest of the tree is
 * checked against.
 *
 * The wording is the wording the table already shipped, up to the two nouns
 * that now follow their count and the two counts that are now grouped.
 *
 * The entries taking the resolved language tag as their first parameter take it
 * for one reason: the count a reader sees is grouped by that tag's own rule, and
 * the noun beside it is selected over the categories the tag reports. Neither
 * decision can be made where the sentence is assembled, because that is one
 * layer below the locale by construction. An entry needing neither takes no tag,
 * so the signature says which entries are locale-sensitive and which are copy.
 */
export const en = {
  appTitle: "City List",
  themeGroup: "Theme",
  themeLight: "Light",
  themeDark: "Dark",
  themeSystem: "System",
  languageName: "Language",
  languageSystem: "System",
  renderFailure:
    "This part of the page could not be displayed. The city data is still loaded, so showing it again may work.",
  renderFailureRetry: "Show it again",
  attribution: (source: string, license: string) =>
    `City data from ${source}, licensed ${license}. Modified: unused columns removed, rows ordered by population.`,
  columnName: "City",
  columnCountry: "Country",
  columnCapital: "Capital",
  columnCountryCode: "Country Code",
  columnPopulation: "Population",
  loading: "Downloading the city data...",
  empty: "No cities found",
  emptyAnnouncement: "No cities found for that search",
  results: (tag: string, shown: number, total: number) => {
    const number = numberFormatFor(tag);

    return `Showing ${number.format(shown)} ${selectPlural(tag, shown, CITY)} out of ${number.format(total)} total ${selectPlural(tag, total, RESULT)}`;
  },
  caption: (tag: string, total: number, sortSummary: string) =>
    `City data with ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTRY)}, currently ${sortSummary}`,
  error: (message: string) => `Error: ${message}`,
  datasetError: DATASET_ERROR_TEXT,
  retry: "Try again",
  sortedAnnouncement: (columnLabel: string, direction: SortedDirection) =>
    `Table sorted by ${columnLabel} in ${DIRECTION[direction]} order`,
  sortClearedAnnouncement: "Table sort cleared",
  unsorted: "not sorted",
  sortSummary: (columnLabel: string, direction: SortedDirection) =>
    `sorted by ${columnLabel} ${DIRECTION[direction]}`,
  pageSize: "Per page:",
  paginationNavigation: "Table pagination navigation",
  firstPage: "Go to first page",
  previousPage: "Go to previous page",
  nextPage: "Go to next page",
  lastPage: "Go to last page",
  searchName: "Search",
  searchPlaceholder: "Search for a city",
  pageStatus: (tag: string, page: number, totalPages: number) => {
    const number = numberFormatFor(tag);

    return `Page ${number.format(page)} of ${number.format(totalPages)}`;
  },
};

/**
 * The shape every other catalog is held to. Derived from the base rather than
 * declared beside it, so the key set has one definition: a catalog missing a key
 * or misspelling one fails the type check rather than rendering undefined at a
 * reader.
 */
export type Catalog = typeof en;
