import {
  en,
  type Catalog,
  type DatasetErrorText,
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

/** Entry by entry, because a built record would need a cast to be typed. */
const DATASET_ERROR_TEXT: DatasetErrorText = {
  notAnObject: (tag, detail) =>
    pseudoize(en.datasetError.notAnObject(tag, detail)),
  missingRows: (tag, detail) =>
    pseudoize(en.datasetError.missingRows(tag, detail)),
  columnOrder: (tag, detail) =>
    pseudoize(en.datasetError.columnOrder(tag, detail)),
  rowShape: (tag, detail) => pseudoize(en.datasetError.rowShape(tag, detail)),
  rowFieldType: (tag, detail) =>
    pseudoize(en.datasetError.rowFieldType(tag, detail)),
  transport: (tag, detail) => pseudoize(en.datasetError.transport(tag, detail)),
  status: (tag, detail) => pseudoize(en.datasetError.status(tag, detail)),
  notJson: (tag, detail) => pseudoize(en.datasetError.notJson(tag, detail)),
  unexpected: (tag, detail) =>
    pseudoize(en.datasetError.unexpected(tag, detail)),
};

/** Each entry translates the base result, so woven values stay bracketed. */
export const pseudo = {
  appTitle: pseudoize(en.appTitle),
  themeGroup: pseudoize(en.themeGroup),
  themeLight: pseudoize(en.themeLight),
  themeDark: pseudoize(en.themeDark),
  themeSystem: pseudoize(en.themeSystem),
  languageName: pseudoize(en.languageName),
  languageSystem: pseudoize(en.languageSystem),
  renderFailure: pseudoize(en.renderFailure),
  renderFailureRetry: pseudoize(en.renderFailureRetry),
  attribution: (source: string, license: string) =>
    pseudoize(en.attribution(source, license)),
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
  datasetError: DATASET_ERROR_TEXT,
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
