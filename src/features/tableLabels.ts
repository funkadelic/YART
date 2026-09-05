// A module, where every other entry in this directory is a folder. One builder
// serves both pages, and putting it inside either feature would make the other
// import across a feature boundary.

import type { DataTableLabels } from "../components/DataTable/DataTable";
import type { SearchInputLabels } from "../components/SearchInput";
import type { Catalog, DomainId } from "../i18n/catalogs/en";

/**
 * The catalog, narrowed to the object the shared table takes. The chrome comes
 * off the common half and the page copy off the named domain. Closing the tag
 * into the locale-sensitive entries here keeps the table's contract at the
 * arity it has always had.
 */
export function buildTableLabels(
  catalog: Catalog,
  domain: DomainId,
  tag: string,
): DataTableLabels {
  const { common } = catalog;
  const copy = catalog[domain];

  return {
    loading: copy.loading,
    empty: copy.empty,
    emptyAnnouncement: copy.emptyAnnouncement,
    results: (shown, total) => copy.results(tag, shown, total),
    caption: (total, sortSummary) => copy.caption(tag, total, sortSummary),
    error: common.error,
    retry: common.retry,
    sortedAnnouncement: common.sortedAnnouncement,
    sortClearedAnnouncement: common.sortClearedAnnouncement,
    unsorted: common.unsorted,
    sortSummary: common.sortSummary,
    pagination: {
      pageSize: common.pageSize,
      navigation: common.paginationNavigation,
      firstPage: common.firstPage,
      previousPage: common.previousPage,
      nextPage: common.nextPage,
      lastPage: common.lastPage,
      pageStatus: (page, totalPages) =>
        common.pageStatus(tag, page, totalPages),
    },
  };
}

/** The search box's own two strings. No tag: neither of them weaves a number. */
export function buildSearchLabels(
  catalog: Catalog,
  domain: DomainId,
): SearchInputLabels {
  return {
    name: catalog.common.searchName,
    placeholder: catalog[domain].searchPlaceholder,
  };
}
