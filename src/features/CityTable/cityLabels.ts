import type { DataTableLabels } from "../../components/DataTable/DataTable";
import type { Catalog } from "../../i18n/catalogs/en";

/**
 * The catalog, narrowed to the object the shared table takes.
 *
 * The table's labels are five entries and two of them are functions of a count.
 * A catalog's entries are the same five, with the resolved language tag in front
 * of the arguments the table supplies. Closing the tag in here is what keeps the
 * table's own contract at the arity it has always had, so growing the catalog
 * never reaches the component layer.
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
  };
}
