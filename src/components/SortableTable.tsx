import { useState } from "react";
import { FiSearch, FiChevronUp, FiChevronDown } from "react-icons/fi";
import {
  MdFirstPage,
  MdLastPage,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";
import type { City } from "../api/getCities";
import {
  cityColumns,
  type CityColumnId,
} from "../features/CityTable/cityColumns";
import {
  DEFAULT_TABLE_STATE,
  applyTableAction,
  type TableState,
} from "./DataTable/tableState";
import { useSortedRows } from "../hooks/useSortedRows";
import { usePaginatedRows } from "../hooks/usePaginatedRows";
import styles from "./SortableTable.module.scss";

// Row identity, as text, because that is what the sort module's tiebreak
// compares. City ids are unique by construction at the parse boundary.
const cityRowId = (city: City) => String(city.id);

interface SortableTableProps {
  data: City[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  loading: boolean;
  // False until the underlying collection has arrived at least once.
  datasetReady: boolean;
  error: Error | null;
  // Optional so the table stays usable on its own, without a container to
  // re-run the request behind it.
  onRetry?: () => void;
}

/**
 * Renders a collection of cities as a searchable, sortable, paginated table.
 *
 * Searching is reported upward rather than carried out here: the container owns
 * the term and the request behind it, and which fields a term matches is
 * decided at the data layer. What this component owns is the view state, which
 * is the sort column and direction, the page position, and the page size.
 *
 * Sorting cycles rather than toggling. A first press sorts ascending, a second
 * descending, and a third returns the table to its unsorted order. Both the
 * ordering and every rendered cell are delegated to the column descriptors.
 */
export function SortableTable({
  data,
  searchTerm,
  onSearchChange,
  loading,
  datasetReady,
  error,
  onRetry,
}: SortableTableProps) {
  // Initialised with the term already in place, so the first render is the
  // table the container asked for rather than one that resets itself on mount.
  const [tableState, setTableState] = useState<TableState<CityColumnId>>(
    () => ({ ...DEFAULT_TABLE_STATE, query: searchTerm }),
  );

  // A new term is a different set of rows rather than a narrowing of the
  // current one, so the position the user chose in the old set does not carry
  // any meaning into it. Adjusting during render rather than in an effect keeps
  // the stale page from being painted first.
  if (searchTerm !== tableState.query) {
    setTableState(
      applyTableAction(tableState, { type: "query", query: searchTerm }),
    );
  }

  const sortedData = useSortedRows(
    data,
    cityColumns,
    tableState.sortColumnId,
    tableState.sortDirection,
    cityRowId,
  );

  const { paginatedData, totalPages, effectivePage } = usePaginatedRows(
    sortedData,
    tableState.page,
    tableState.pageSize,
  );

  const handleSort = (columnId: CityColumnId) => {
    setTableState((state) =>
      applyTableAction(state, { type: "sort", columnId }),
    );
  };

  const handlePageChange = (page: number) => {
    setTableState((state) => applyTableAction(state, { type: "page", page }));
  };

  const handleFirstPage = () => {
    handlePageChange(1);
  };

  const handleLastPage = () => {
    handlePageChange(totalPages);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pageSize = parseInt(e.target.value, 10);
    setTableState((state) =>
      applyTableAction(state, { type: "pageSize", pageSize }),
    );
  };

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  // The announcements name what is on screen, and what is on screen is the
  // column label. tableState.sortColumnId is the field name, which is not the name of
  // anything the reader can see.
  const activeLabel = cityColumns.find(
    (column) => column.id === tableState.sortColumnId,
  )?.label;

  return (
    <div className={styles.container}>
      {/* a11y: Live region for announcing sort changes */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {tableState.sortDirection && activeLabel
          ? `Table sorted by ${activeLabel} in ${tableState.sortDirection === "asc" ? "ascending" : "descending"} order`
          : tableState.hasSorted
            ? "Table sort cleared"
            : ""}
      </div>
      {/* a11y: mounted unconditionally rather than inside the branch that
          renders the table. A live region created with its message already in
          it announces nothing, which would drop the first row count on a cold
          start and again after a successful retry. The empty result gets a
          sentence of its own for the same reason in reverse: emptying a region
          is not an announcement either, so a search matching no rows would be
          indistinguishable from a request that never came back. */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {error || loading || !datasetReady
          ? ""
          : sortedData.length === 0
            ? "No cities found for that search"
            : `Showing ${paginatedData.length} cities out of ${sortedData.length} total results`}
      </div>
      <div className={styles.searchContainer}>
        <div className={styles.searchInput}>
          <FiSearch className={styles.searchIcon} />
          <input
            aria-label="Search"
            type="text"
            placeholder="Search for a city"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {error ? (
        // a11y: the failure arrives after the initial render, so without a live
        // region a screen reader user is never told the load failed or that a
        // way back is on offer. alert rather than status because the table it
        // replaces is gone.
        <div className={styles.error} role="alert">
          Error: {error.message}
          {/* A failed dataset load makes every search fail, so the way back
              belongs in the region that already reports it rather than in a
              second error surface. A native button carries the role, the
              focus, and the keyboard activation on its own. */}
          {onRetry ? (
            <button
              type="button"
              className={styles.retryButton}
              onClick={onRetry}
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : !datasetReady ? (
        // The whole view is replaced until the collection has arrived once,
        // the first paint before the request even starts included: the empty
        // result copy would otherwise claim a search had been made and matched
        // nothing. Once the collection has arrived, a refetch keeps the table
        // mounted so it does not unmount and flash on every keystroke.
        <div className={styles.loading}>Downloading the city data...</div>
      ) : (
        <>
          {paginatedData.length === 0 ? (
            <div className={styles.noResults}>No cities found</div>
          ) : (
            <>
              <div
                className={`${styles.tableContainer} ${loading ? styles.refreshing : ""}`}
                aria-busy={loading}
              >
                <table className={styles.table}>
                  <caption className={styles.srOnly}>
                    City data with {sortedData.length} entries, currently{" "}
                    {tableState.sortDirection
                      ? `sorted by ${activeLabel} ${tableState.sortDirection}ending`
                      : "not sorted"}
                  </caption>
                  <thead>
                    <tr>
                      {cityColumns.map((column) => {
                        const isActive = tableState.sortColumnId === column.id;
                        const sortDirection = isActive
                          ? tableState.sortDirection
                          : null;

                        return (
                          <th
                            key={column.id}
                            scope="col"
                            aria-sort={
                              sortDirection === "asc"
                                ? "ascending"
                                : sortDirection === "desc"
                                  ? "descending"
                                  : "none"
                            }
                          >
                            {
                              // a11y: the accessible name is the column label
                              // alone, so the control keeps one identity across
                              // presses. The sort state is carried by the
                              // header cell's own attribute, where the
                              // specification puts it, and announced by the
                              // live region above. The button handles Enter and
                              // Space itself; a manual key handler alongside it
                              // would fire twice.
                              <button
                                type="button"
                                className={styles.sortButton}
                                onClick={() => handleSort(column.id)}
                              >
                                {column.label}
                                {sortDirection === "asc" && (
                                  <FiChevronUp aria-hidden="true" />
                                )}
                                {sortDirection === "desc" && (
                                  <FiChevronDown aria-hidden="true" />
                                )}
                              </button>
                            }
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((city) => (
                      <tr key={city.id}>
                        {cityColumns.map((column) => (
                          <td key={column.id}>{column.renderCell(city)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.paginationContainer}>
                <div className={styles.pageSizeContainer}>
                  <label htmlFor="pageSize">Per page:</label>
                  <select
                    id="pageSize"
                    value={tableState.pageSize}
                    onChange={handlePageSizeChange}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {totalPages > 1 && (
                  <nav
                    aria-label="Table pagination navigation"
                    className={styles.navigationContainer}
                  >
                    <button
                      onClick={handleFirstPage}
                      disabled={effectivePage === 1}
                      title="Go to first page"
                      // a11y: named by the action alone, as the sort headers
                      // are. A name carrying the position changes under focus,
                      // which re-announces the whole control on every press;
                      // the live region below is what reports where the user
                      // landed.
                      aria-label="Go to first page"
                      className={styles.navButton}
                    >
                      <MdFirstPage aria-hidden="true" />
                    </button>

                    <button
                      onClick={() => handlePageChange(effectivePage - 1)}
                      disabled={effectivePage === 1}
                      title="Go to previous page"
                      aria-label="Go to previous page"
                      className={styles.navButton}
                    >
                      <MdChevronLeft aria-hidden="true" />
                    </button>

                    {/* a11y: aria-atomic because React mutates only the page
                        number inside this label. Without it the announcement
                        is the bare number, and since the controls are named by
                        their action alone this region is the only thing that
                        reports where the user landed. */}
                    <span
                      className={styles.pageInfo}
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      Page {effectivePage} of {totalPages}
                    </span>

                    <button
                      onClick={() => handlePageChange(effectivePage + 1)}
                      disabled={effectivePage === totalPages}
                      title="Go to next page"
                      aria-label="Go to next page"
                      className={styles.navButton}
                    >
                      <MdChevronRight aria-hidden="true" />
                    </button>

                    <button
                      onClick={handleLastPage}
                      disabled={effectivePage === totalPages}
                      title="Go to last page"
                      aria-label="Go to last page"
                      className={styles.navButton}
                    >
                      <MdLastPage aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
