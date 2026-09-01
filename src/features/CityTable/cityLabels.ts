import type { DataTableLabels } from "../../components/DataTable/DataTable";
import type { SearchInputLabels } from "../../components/SearchInput";
import type { Catalog } from "../../i18n/catalogs/en";

/**
 * The catalog, narrowed to the object the shared table takes: a flat set of
 * keys becomes a shape. Closing the tag into the locale-sensitive entries here
 * is what keeps the table's contract at the arity it has always had.
 */
export function buildTableLabels(
  catalog: Catalog,
  tag: string,
): DataTableLabels {
  return {
    loading: catalog.loading,
    empty: catalog.empty,
    emptyAnnouncement: catalog.emptyAnnouncement,
    results: (shown, total) => catalog.results(tag, shown, total),
    caption: (total, sortSummary) => catalog.caption(tag, total, sortSummary),
    error: catalog.error,
    retry: catalog.retry,
    sortedAnnouncement: catalog.sortedAnnouncement,
    sortClearedAnnouncement: catalog.sortClearedAnnouncement,
    unsorted: catalog.unsorted,
    sortSummary: catalog.sortSummary,
    pagination: {
      pageSize: catalog.pageSize,
      navigation: catalog.paginationNavigation,
      firstPage: catalog.firstPage,
      previousPage: catalog.previousPage,
      nextPage: catalog.nextPage,
      lastPage: catalog.lastPage,
      pageStatus: (page, totalPages) =>
        catalog.pageStatus(tag, page, totalPages),
    },
  };
}

/** The search box's own two strings. No tag: neither weaves a number. */
export function buildSearchLabels(catalog: Catalog): SearchInputLabels {
  return {
    name: catalog.searchName,
    placeholder: catalog.searchPlaceholder,
  };
}
