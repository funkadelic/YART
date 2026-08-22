import { useState, useMemo } from "react";
import { FiSearch, FiChevronUp, FiChevronDown } from "react-icons/fi";
import {
  MdFirstPage,
  MdLastPage,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";
import type { City } from "../api/getCities";
import styles from "./SortableTable.module.scss";

interface Column {
  key: keyof City;
  label: string;
  sortable: boolean;
}

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

interface SortButtonProps {
  column: Column;
  sortState: SortState;
}

function SortButton({ column, sortState }: SortButtonProps) {
  const isActive = sortState.column === column.key;
  const direction = isActive ? sortState.direction : null;

  // helper method to get the correct aria label based on sort
  const getAriaLabel = () => {
    if (!direction) return `Sort by ${column.label} ascending`;
    if (direction === "asc") return `Sort by ${column.label} descending`;
    return `Clear ${column.label} sort`;
  };

  return (
    <span className={styles.sortButton} aria-label={getAriaLabel()}>
      {column.label}
      {direction === "asc" && <FiChevronUp aria-hidden="true" />}
      {direction === "desc" && <FiChevronDown aria-hidden="true" />}
    </span>
  );
}

/**
 * SortableTable component that implements P0, P2, and P3 requirements:
 * - Search by city/country name
 * - Basic sorting (ascending toggle)
 * - Pagination with dynamic page size selection (P2)
 * - First and last page navigation (P3)
 * - Error handling and empty states
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
  // P0: Basic sorting with three states: ascending, descending, no sort
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });

  // P0/P2: Pagination with dynamic page size
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // P2: Dynamic page size (default 10)

  // Table columns
  const columns: Column[] = [
    { key: "name", label: "City", sortable: true },
    { key: "country", label: "Country", sortable: true },
    { key: "capital", label: "Capital", sortable: true },
    { key: "countryIso3", label: "Country Code", sortable: true },
    { key: "population", label: "Population", sortable: true },
  ];

  // P0: Sort data based on current sort state
  const sortedData = useMemo(() => {
    if (!sortState.column || !sortState.direction) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortState.column!];
      const bVal = b[sortState.column!];
      let comparison = 0;

      // Handle string comparison (city/country names)
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal);
      }
      // Handle number comparison (population)
      else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      }

      // Apply sort direction
      return sortState.direction === "desc" ? -comparison : comparison;
    });
  }, [data, sortState]);

  // P0/P2: Paginate sorted data with dynamic page size
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // P0: Cycle through sort states: none -> asc -> desc -> none
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

  // P0: Navigate between pages
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // P3: Navigate to first page
  const handleFirstPage = () => {
    setCurrentPage(1);
  };

  // P3: Navigate to last page
  const handleLastPage = () => {
    setCurrentPage(totalPages);
  };

  // P2: Handle page size changes
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
      {/* P0: Search input - searches both city and country names */}
      <div className={styles.searchContainer}>
        <div className={styles.searchInput}>
          <FiSearch className={styles.searchIcon} />
          <input
            role="textbox"
            aria-label="Search"
            type="text"
            placeholder="Search for a city"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* P0: Error handling - show error message when search fails */}
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
          {/* P0: Empty state - show message when no results found */}
          {paginatedData.length === 0 ? (
            <div className={styles.noResults}>No cities found</div>
          ) : (
            <>
              {/* P0: Sortable table - click headers to sort ascending */}
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
                      {columns.map((column) => {
                        const isActive = sortState.column === column.key;
                        const sortDirection = isActive
                          ? sortState.direction
                          : null;

                        return (
                          <th
                            key={column.key}
                            onClick={
                              column.sortable
                                ? () => handleSort(column.key)
                                : undefined
                            }
                            onKeyDown={
                              column.sortable
                                ? (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      handleSort(column.key);
                                    }
                                  }
                                : undefined
                            }
                            tabIndex={column.sortable ? 0 : undefined}
                            aria-sort={
                              column.sortable
                                ? sortDirection === "asc"
                                  ? "ascending"
                                  : sortDirection === "desc"
                                    ? "descending"
                                    : "none"
                                : undefined
                            }
                            role={
                              column.sortable
                                ? "columnheader button"
                                : "columnheader"
                            }
                            style={
                              column.sortable
                                ? { cursor: "pointer" }
                                : undefined
                            }
                          >
                            {column.sortable ? (
                              <SortButton
                                column={column}
                                sortState={sortState}
                              />
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

              {/* P2: Pagination with dynamic page size selection */}
              <div className={styles.paginationContainer}>
                {/* P2: Page size selector */}
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

                {/* P0/P3: Pagination navigation (only show if multiple pages) */}
                {totalPages > 1 && (
                  <nav
                    aria-label="Table pagination navigation"
                    className={styles.navigationContainer}
                  >
                    {/* P3: First page button */}
                    <button
                      onClick={handleFirstPage}
                      disabled={currentPage === 1}
                      title="Go to first page"
                      aria-label={`Go to first page of ${totalPages} pages`}
                      className={styles.navButton}
                    >
                      <MdFirstPage aria-hidden="true" />
                    </button>

                    {/* P0: Previous page button */}
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      title="Go to previous page"
                      aria-label={`Go to previous page, currently on page ${currentPage} of ${totalPages}`}
                      className={styles.navButton}
                    >
                      <MdChevronLeft aria-hidden="true" />
                    </button>

                    <span
                      className={styles.pageInfo}
                      aria-current="page"
                      aria-live="polite"
                    >
                      Page {currentPage} of {totalPages}
                    </span>

                    {/* P0: Next page button */}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      title="Go to next page"
                      aria-label={`Go to next page, currently on page ${currentPage} of ${totalPages}`}
                      className={styles.navButton}
                    >
                      <MdChevronRight aria-hidden="true" />
                    </button>

                    {/* P3: Last page button */}
                    <button
                      onClick={handleLastPage}
                      disabled={currentPage === totalPages}
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
