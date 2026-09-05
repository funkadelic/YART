import type { DatasetErrorCode } from "../../data/loadEnvelope";
import { listFormatFor, numberFormatFor, selectPlural } from "../format";

/**
 * The nouns the woven sentences pluralize, total over the two categories
 * English reports, so there is no branch the coverage gate cannot cover.
 */
const CITY = { one: "city", other: "cities" };
const FILM = { one: "film", other: "films" };
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

/**
 * What both domain blocks carry. The columns record is keyed loosely because the
 * two domains have different columns; every other key is identical by
 * construction, which is what makes a films entry missing from a translated
 * catalog a compile error rather than a test nobody wrote.
 */
export interface DomainCatalog {
  readonly appTitle: string;
  readonly renderFailure: string;
  readonly attribution: (source: string, license: string) => string;
  readonly loading: string;
  readonly empty: string;
  readonly emptyAnnouncement: string;
  readonly results: (tag: string, shown: number, total: number) => string;
  readonly caption: (tag: string, total: number, sortSummary: string) => string;
  readonly searchPlaceholder: string;
  readonly datasetError: DatasetErrorText;
  readonly columns: Readonly<Record<string, string>>;
}

const CITY_ERROR_TEXT: DatasetErrorText = {
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

/**
 * Written out rather than derived from the city set with the noun as an
 * argument. A caller handing over a word has made a grammatical decision one
 * layer too early, and gender and agreement break it in Spanish and French.
 */
const FILM_ERROR_TEXT: DatasetErrorText = {
  notAnObject: () => "The film data could not be read.",
  missingRows: () => "The film data is missing its rows array.",
  columnOrder: () =>
    "The film data has an unexpected column order and was not loaded.",
  rowShape: (tag, at) =>
    `Film row ${numberFormatFor(tag).format(at)} does not have 7 fields and was not loaded.`,
  rowFieldType: (tag, at) =>
    `Film row ${numberFormatFor(tag).format(at)} has a field of the wrong type and was not loaded.`,
  transport: () =>
    "The film data could not be downloaded. Check your connection and try again.",
  status: (tag, status) =>
    `The film data could not be downloaded (status ${numberFormatFor(tag).format(status)}).`,
  notJson: () => "The film data was downloaded but could not be read as JSON.",
  unexpected: () => "An unexpected error occurred.",
};

/** An entry takes the tag only when it groups a number or picks a plural. */
export const en = {
  // The chrome, which names no domain and is read by both pages unchanged.
  common: {
    themeGroup: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    languageName: "Language",
    languageSystem: "System",
    renderFailureRetry: "Show it again",
    error: (message: string) => `Error: ${message}`,
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
    pageStatus: (tag: string, page: number, totalPages: number) => {
      const number = numberFormatFor(tag);

      return `Page ${number.format(page)} of ${number.format(totalPages)}`;
    },
    // Here rather than in a domain: joining a list is a rule of the language
    // rather than a fact about films, and no cell may write a separator.
    list: (tag: string, values: readonly string[]) =>
      listFormatFor(tag).format(values),
  },
  cities: {
    appTitle: "City List",
    renderFailure:
      "This part of the page could not be displayed. The city data is still loaded, so showing it again may work.",
    attribution: (source: string, license: string) =>
      `City data from ${source}, licensed ${license}. Modified: unused columns removed, rows ordered by population.`,
    loading: "Downloading the city data...",
    empty: "No cities found",
    emptyAnnouncement: "No cities found for that search",
    results: (tag: string, shown: number, total: number) => {
      const number = numberFormatFor(tag);

      return `Showing ${number.format(shown)} ${selectPlural(tag, shown, CITY)} out of ${number.format(total)} total ${selectPlural(tag, total, RESULT)}`;
    },
    caption: (tag: string, total: number, sortSummary: string) =>
      `City data with ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTRY)}, currently ${sortSummary}`,
    searchPlaceholder: "Search for a city",
    datasetError: CITY_ERROR_TEXT,
    columns: {
      name: "City",
      country: "Country",
      capital: "Capital",
      countryIso3: "Country Code",
      population: "Population",
    },
  } satisfies DomainCatalog,
  films: {
    appTitle: "Film List",
    renderFailure:
      "This part of the page could not be displayed. The film data is still loaded, so showing it again may work.",
    // A courtesy rather than an obligation, and the sentence says so: CC0
    // requires no attribution at all, and the upstream data access page asks
    // for the mention rather than demanding it.
    attribution: (source: string, license: string) =>
      `Film data from ${source}, released under ${license}. Credited as a courtesy, since none is required. Modified: unused bindings dropped, multi-valued properties collapsed to arrays, rows limited by sitelink count.`,
    loading: "Downloading the film data...",
    empty: "No films found",
    emptyAnnouncement: "No films found for that search",
    results: (tag: string, shown: number, total: number) => {
      const number = numberFormatFor(tag);

      return `Showing ${number.format(shown)} ${selectPlural(tag, shown, FILM)} out of ${number.format(total)} total ${selectPlural(tag, total, RESULT)}`;
    },
    caption: (tag: string, total: number, sortSummary: string) =>
      `Film data with ${numberFormatFor(tag).format(total)} ${selectPlural(tag, total, ENTRY)}, currently ${sortSummary}`,
    searchPlaceholder: "Search for a film",
    datasetError: FILM_ERROR_TEXT,
    columns: {
      title: "Title",
      year: "Year",
      runtime: "Runtime",
      directors: "Directors",
      genres: "Genres",
      countries: "Countries",
    },
  } satisfies DomainCatalog,
};

/** Derived from the base, so a missing key in another catalog fails to type. */
export type Catalog = typeof en;

/** Derived rather than declared, so a third domain arrives here on its own. */
export type DomainId = Exclude<keyof Catalog, "common">;
