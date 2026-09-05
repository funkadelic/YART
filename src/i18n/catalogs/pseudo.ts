import {
  en,
  type Catalog,
  type DatasetErrorText,
  type DomainCatalog,
  type DomainId,
  type SortedDirection,
} from "./en";

// The pseudo-locale, so direction and truncation have something to prove.

/** An isolate, not a mark: a mark cannot bound a run, only start one. */
const FIRST_STRONG_ISOLATE = "\u2066";

/** Closes the run the isolate above opened. */
const POP_DIRECTIONAL_ISOLATE = "\u2069";

/** What the padding is made of. Visibly filler, so nobody reads it as copy. */
const PADDING_CHARACTER = "~";

/** The brackets bound the unit; the padding is what a translation costs. */
export function pseudoize(message: string): string {
  const padding = PADDING_CHARACTER.repeat(Math.ceil(message.length / 3));

  return `[${FIRST_STRONG_ISOLATE}${message}${POP_DIRECTIONAL_ISOLATE} ${padding}]`;
}

/**
 * Entry by entry, because a built record would need a cast to be typed. Taken
 * over the domain, so a new failure code costs one line here and not two.
 */
function pseudoErrors(domain: DomainId): DatasetErrorText {
  const base = en[domain].datasetError;

  return {
    notAnObject: (tag, detail) => pseudoize(base.notAnObject(tag, detail)),
    missingRows: (tag, detail) => pseudoize(base.missingRows(tag, detail)),
    columnOrder: (tag, detail) => pseudoize(base.columnOrder(tag, detail)),
    rowShape: (tag, detail) => pseudoize(base.rowShape(tag, detail)),
    rowFieldType: (tag, detail) => pseudoize(base.rowFieldType(tag, detail)),
    transport: (tag, detail) => pseudoize(base.transport(tag, detail)),
    status: (tag, detail) => pseudoize(base.status(tag, detail)),
    notJson: (tag, detail) => pseudoize(base.notJson(tag, detail)),
    unexpected: (tag, detail) => pseudoize(base.unexpected(tag, detail)),
  };
}

/** Each entry translates the base result, so woven values stay bracketed. */
export const pseudo = {
  common: {
    themeGroup: pseudoize(en.common.themeGroup),
    themeLight: pseudoize(en.common.themeLight),
    themeDark: pseudoize(en.common.themeDark),
    themeSystem: pseudoize(en.common.themeSystem),
    languageName: pseudoize(en.common.languageName),
    languageSystem: pseudoize(en.common.languageSystem),
    renderFailureRetry: pseudoize(en.common.renderFailureRetry),
    error: (message: string) => pseudoize(en.common.error(message)),
    retry: pseudoize(en.common.retry),
    sortedAnnouncement: (columnLabel: string, direction: SortedDirection) =>
      pseudoize(en.common.sortedAnnouncement(columnLabel, direction)),
    sortClearedAnnouncement: pseudoize(en.common.sortClearedAnnouncement),
    unsorted: pseudoize(en.common.unsorted),
    sortSummary: (columnLabel: string, direction: SortedDirection) =>
      pseudoize(en.common.sortSummary(columnLabel, direction)),
    pageSize: pseudoize(en.common.pageSize),
    paginationNavigation: pseudoize(en.common.paginationNavigation),
    firstPage: pseudoize(en.common.firstPage),
    previousPage: pseudoize(en.common.previousPage),
    nextPage: pseudoize(en.common.nextPage),
    lastPage: pseudoize(en.common.lastPage),
    searchName: pseudoize(en.common.searchName),
    pageStatus: (tag: string, page: number, totalPages: number) =>
      pseudoize(en.common.pageStatus(tag, page, totalPages)),
    list: (tag: string, values: readonly string[]) =>
      pseudoize(en.common.list(tag, values)),
  },
  cities: {
    appTitle: pseudoize(en.cities.appTitle),
    renderFailure: pseudoize(en.cities.renderFailure),
    attribution: (source: string, license: string) =>
      pseudoize(en.cities.attribution(source, license)),
    loading: pseudoize(en.cities.loading),
    empty: pseudoize(en.cities.empty),
    emptyAnnouncement: pseudoize(en.cities.emptyAnnouncement),
    results: (tag: string, shown: number, total: number) =>
      pseudoize(en.cities.results(tag, shown, total)),
    caption: (tag: string, total: number, sortSummary: string) =>
      pseudoize(en.cities.caption(tag, total, sortSummary)),
    searchPlaceholder: pseudoize(en.cities.searchPlaceholder),
    datasetError: pseudoErrors("cities"),
    columns: {
      name: pseudoize(en.cities.columns.name),
      country: pseudoize(en.cities.columns.country),
      capital: pseudoize(en.cities.columns.capital),
      countryIso3: pseudoize(en.cities.columns.countryIso3),
      population: pseudoize(en.cities.columns.population),
    },
  } satisfies DomainCatalog,
  films: {
    appTitle: pseudoize(en.films.appTitle),
    renderFailure: pseudoize(en.films.renderFailure),
    attribution: (source: string, license: string) =>
      pseudoize(en.films.attribution(source, license)),
    loading: pseudoize(en.films.loading),
    empty: pseudoize(en.films.empty),
    emptyAnnouncement: pseudoize(en.films.emptyAnnouncement),
    results: (tag: string, shown: number, total: number) =>
      pseudoize(en.films.results(tag, shown, total)),
    caption: (tag: string, total: number, sortSummary: string) =>
      pseudoize(en.films.caption(tag, total, sortSummary)),
    searchPlaceholder: pseudoize(en.films.searchPlaceholder),
    datasetError: pseudoErrors("films"),
    columns: {
      title: pseudoize(en.films.columns.title),
      year: pseudoize(en.films.columns.year),
      runtime: pseudoize(en.films.columns.runtime),
      directors: pseudoize(en.films.columns.directors),
      genres: pseudoize(en.films.columns.genres),
      countries: pseudoize(en.films.columns.countries),
    },
  } satisfies DomainCatalog,
} satisfies Catalog;
