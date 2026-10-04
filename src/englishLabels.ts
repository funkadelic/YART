import type { DataTableLabels } from "./components/DataTable/DataTable.js";
import type { SortDirection } from "./components/DataTable/tableState.js";
import type { SearchInputLabels } from "./components/SearchInput.js";
import { numberFormatFor, selectPlural } from "./i18n/format.js";

const TAG = "en";

/** The noun for each plural form English uses, one and other. */
const ROW = { one: "row", other: "rows" };

/** The word each sort direction reads as. */
const DIRECTION: Readonly<Record<SortDirection, string>> = {
  asc: "ascending",
  desc: "descending",
};

/** Groups a count the way an English reader expects. */
function count(value: number): string {
  return numberFormatFor(TAG).format(value);
}

/** English table copy. Spread it and override the entries you need. */
export const englishTableLabels: DataTableLabels = {
  loading: "Loading...",
  empty: "No rows found",
  emptyAnnouncement: "No rows found for that search",
  results: (shown, total) =>
    `Showing ${count(shown)} of ${count(total)} ${selectPlural(TAG, total, ROW)}`,
  caption: (total, sortSummary) =>
    `${count(total)} ${selectPlural(TAG, total, ROW)}, ${sortSummary}`,
  error: (message) => `Error: ${message}`,
  retry: "Try again",
  sortedAnnouncement: (columnLabel, direction) =>
    `Sorted by ${columnLabel}, ${DIRECTION[direction]}`,
  sortClearedAnnouncement: "Sort removed",
  unsorted: "not sorted",
  sortSummary: (columnLabel, direction) =>
    `sorted by ${columnLabel}, ${DIRECTION[direction]}`,
  pagination: {
    pageSize: "Rows per page",
    navigation: "Pagination",
    firstPage: "First page",
    previousPage: "Previous page",
    nextPage: "Next page",
    lastPage: "Last page",
    pageStatus: (page, totalPages) =>
      `Page ${count(page)} of ${count(totalPages)}`,
  },
};

/** English search box copy. Spread it and override the entries you need. */
export const englishSearchLabels: SearchInputLabels = {
  name: "Search",
  placeholder: "Search the table",
};
