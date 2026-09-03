import type { DatasetErrorCode } from "../../api/getCities";
import { numberFormatFor, selectPlural } from "../format";

/**
 * The nouns the woven sentences pluralize, total over the two categories
 * English reports, so there is no branch the coverage gate cannot cover.
 */
const CITY = { one: "city", other: "cities" };
const RESULT = { one: "result", other: "results" };
const ENTRY = { one: "entry", other: "entries" };

/** Declared here rather than imported: a catalog must not learn about tables. */
export type SortedDirection = "asc" | "desc";

/** A record rather than a suffix: "ascend" plus "ing" is one language only. */
const DIRECTION: Readonly<Record<SortedDirection, string>> = {
  asc: "ascending",
  desc: "descending",
};

/**
 * One sentence per failure code, total over the code union, so a new code fails
 * the type check and no branch is left the coverage gate cannot reach.
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
  unexpected: () => "An unexpected error occurred.",
};

/** An entry takes the tag only when it groups a number or picks a plural. */
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

/** Derived from the base, so a missing key in another catalog fails to type. */
export type Catalog = typeof en;
