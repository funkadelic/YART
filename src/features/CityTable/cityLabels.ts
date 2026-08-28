import type { DataTableLabels } from "../../components/DataTable/DataTable";
import type { SearchInputLabels } from "../../components/SearchInput";
import type { Catalog } from "../../i18n/catalogs/en";

/**
 * The catalog, narrowed to the object the shared table takes.
 *
 * A catalog is a flat set of keys; the table's labels are a shape, with the page
 * controls' own strings nested where the table hands them on. This is where the
 * one becomes the other, and it is the only place the two vocabularies meet.
 *
 * The locale-sensitive entries take the resolved language tag ahead of the
 * arguments the table supplies, and closing that tag in here is what keeps the
 * table's own contract at the arity it has always had. An entry that needs no
 * tag is passed through by reference rather than wrapped in an arrow that would
 * only forward it, so the closure count stays at what the seam actually needs.
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

/**
 * The catalog, narrowed to the two strings the search box shows.
 *
 * Its own builder rather than a third field on the object above, because the box
 * is a sibling of the table rather than part of it: the table never sees these
 * two strings and has no business carrying them.
 *
 * No tag, and the absence is the point. Neither entry weaves a number or a
 * plural, so there is nothing here for a formatter to do, and taking a parameter
 * that changes nothing would put a second key on the memo that reads it.
 */
export function buildSearchLabels(catalog: Catalog): SearchInputLabels {
  return {
    name: catalog.searchName,
    placeholder: catalog.searchPlaceholder,
  };
}
