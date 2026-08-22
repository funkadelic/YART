import { useState, useMemo } from "react";
import { FiSearch, FiChevronUp, FiChevronDown } from "react-icons/fi";
import {
  MdFirstPage,
  MdLastPage,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";
import type { City } from "../api/getCities";
import { compareRows } from "./compareRows";
import styles from "./SortableTable.module.scss";

interface Column {
  key: keyof City;
  label: string;
  sortable: boolean;
}

const COLUMNS: Column[] = [
  { key: "name", label: "City", sortable: true },
  { key: "country", label: "Country", sortable: true },
  { key: "capital", label: "Capital", sortable: true },
  { key: "countryIso3", label: "Country Code", sortable: true },
  { key: "population", label: "Population", sortable: true },
];

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

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: keyof City | null;
  direction: SortDirection;
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
 * descending, and a third returns the table to its unsorted order. The ordering
 * itself is delegated to compareRows.
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
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const sortedData = useMemo(() => {
    const { column, direction } = sortState;
    if (!column || !direction) return data;

    // The resolved collection is module-cached and shared by every reader, so
    // it is treated as immutable and the sort runs over a copy.
    return [...data].sort((a, b) => compareRows(a, b, column, direction));
  }, [data, sortState]);

  const { paginatedData, totalPages, effectivePage } = useMemo(() => {
    // Floored at one so an empty result set still counts as a single page.
    // Zero would be a page count nothing can be on, and callers outside the
    // navigation's own visibility guard have no protection from it.
    const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
    // Clamped for reading only. The position held in state is deliberately
    // left alone, so a result set that widens again restores the user where
    // they were rather than stranding them on whatever the narrowed set
    // allowed, and so a position arriving from outside survives a fetch that
    // has not resolved yet.
    const effectivePage = Math.min(Math.max(currentPage, 1), totalPages);
    const startIndex = (effectivePage - 1) * pageSize;
    return {
      paginatedData: sortedData.slice(startIndex, startIndex + pageSize),
      totalPages,
      effectivePage,
    };
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (column: keyof City) => {
    setSortState((prevState) => {
      if (prevState.column !== column) {
        // New column: start with ascending
        return { column, direction: "asc" };
      } else {
        // Same column: cycle through states
        if (prevState.direction === "asc") {
          return { column, direction: "desc" };
        } else if (prevState.direction === "desc") {
          return { column: null, direction: null };
        } else {
          return { column, direction: "asc" };
        }
      }
    });
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleFirstPage = () => {
    setCurrentPage(1);
  };

  const handleLastPage = () => {
    setCurrentPage(totalPages);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = parseInt(e.target.value, 10);
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when page size changes
  };

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  return (
    <div className={styles.container}>
      {/* a11y: Live region for announcing sort changes */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {sortState.direction && sortState.column
          ? `Table sorted by ${sortState.column} in ${sortState.direction === "asc" ? "ascending" : "descending"} order`
          : ""}
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
      ) : loading && !datasetReady ? (
        // The whole view is replaced only while the collection has never
        // arrived. Once it has, a refetch keeps the table mounted so it does
        // not unmount and flash on every keystroke.
        <div className={styles.loading}>Downloading the city data...</div>
      ) : (
        <>
          {/* a11y: Live region for announcing data updates */}
          <div aria-live="polite" aria-atomic="false" className={styles.srOnly}>
            {!loading && paginatedData.length > 0
              ? `Showing ${paginatedData.length} cities out of ${sortedData.length} total results`
              : ""}
          </div>
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
                    {sortState.direction
                      ? `sorted by ${sortState.column} ${sortState.direction}ending`
                      : "not sorted"}
                  </caption>
                  <thead>
                    <tr>
                      {COLUMNS.map((column) => {
                        const isActive = sortState.column === column.key;
                        const sortDirection = isActive
                          ? sortState.direction
                          : null;

                        return (
                          <th
                            key={column.key}
                            scope="col"
                            aria-sort={
                              column.sortable
                                ? sortDirection === "asc"
                                  ? "ascending"
                                  : sortDirection === "desc"
                                    ? "descending"
                                    : "none"
                                : undefined
                            }
                          >
                            {column.sortable ? (
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
                                onClick={() => handleSort(column.key)}
                              >
                                {column.label}
                                {sortDirection === "asc" && (
                                  <FiChevronUp aria-hidden="true" />
                                )}
                                {sortDirection === "desc" && (
                                  <FiChevronDown aria-hidden="true" />
                                )}
                              </button>
                            ) : (
                              column.label
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((city) => (
                      <tr key={city.id}>
                        <td>{city.name}</td>
                        <td>{city.country}</td>
                        <td>{city.capital}</td>
                        <td>{city.countryIso3}</td>
                        <td>{city.population.toLocaleString()}</td>
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
                    value={pageSize}
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
                      aria-label={`Go to first page of ${totalPages} pages`}
                      className={styles.navButton}
                    >
                      <MdFirstPage aria-hidden="true" />
                    </button>

                    <button
                      onClick={() => handlePageChange(effectivePage - 1)}
                      disabled={effectivePage === 1}
                      title="Go to previous page"
                      aria-label={`Go to previous page, currently on page ${effectivePage} of ${totalPages}`}
                      className={styles.navButton}
                    >
                      <MdChevronLeft aria-hidden="true" />
                    </button>

                    <span className={styles.pageInfo} aria-live="polite">
                      Page {effectivePage} of {totalPages}
                    </span>

                    <button
                      onClick={() => handlePageChange(effectivePage + 1)}
                      disabled={effectivePage === totalPages}
                      title="Go to next page"
                      aria-label={`Go to next page, currently on page ${effectivePage} of ${totalPages}`}
                      className={styles.navButton}
                    >
                      <MdChevronRight aria-hidden="true" />
                    </button>

                    <button
                      onClick={handleLastPage}
                      disabled={effectivePage === totalPages}
                      title="Go to last page"
                      aria-label={`Go to last page, page ${totalPages} of ${totalPages}`}
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
