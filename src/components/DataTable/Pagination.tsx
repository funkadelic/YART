import { useId } from "react";
import {
  MdFirstPage,
  MdLastPage,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";

import { PAGE_SIZE_OPTIONS } from "./tableState";
import styles from "./Pagination.module.scss";

/**
 * Every string the page controls render.
 *
 * A slice of the table's own labels object rather than a second prop the caller
 * assembles, so one object reaches the table and the table hands this part of it
 * on. Each of the four action entries is used twice, once as the tooltip and
 * once as the accessible name, which is what stops a translation moving one and
 * leaving the other behind.
 */
export interface PaginationLabels {
  /** Names the control choosing how many rows a page holds. */
  readonly pageSize: string;
  /** The accessible name of the landmark the page controls sit in. */
  readonly navigation: string;
  /** Names the control jumping to the first page. */
  readonly firstPage: string;
  /** Names the control stepping one page back. */
  readonly previousPage: string;
  /** Names the control stepping one page on. */
  readonly nextPage: string;
  /** Names the control jumping to the last page. */
  readonly lastPage: string;
  /** Where the reader is, as the live region beside the controls reports it. */
  readonly pageStatus: (page: number, totalPages: number) => string;
}

interface PaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
}

/**
 * The page-size control and the page navigation.
 *
 * It knows the page position and nothing else about the table's view state, so
 * a change to how sorting is held cannot reach it. The select's value is parsed
 * to a number here, at the only place that sees the event, so the callback
 * never receives a string.
 */
export function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  // Derived rather than a fixed string, so two tables on one page do not label
  // each other's select.
  const pageSizeId = useId();

  /**
   * Turns the select's string value into the number the arithmetic divides by.
   * The option list is a closed set, so nothing out of range or non-numeric can
   * reach the arithmetic through this control.
   */
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onPageSizeChange(Number.parseInt(e.target.value, 10));
  };

  /** Jumps to the first page. */
  const handleFirstPage = () => {
    onPageChange(1);
  };

  /** Jumps to the last page that exists for the current row count. */
  const handleLastPage = () => {
    onPageChange(totalPages);
  };

  return (
    <div className={styles.paginationContainer}>
      <div className={styles.pageSizeContainer}>
        <label htmlFor={pageSizeId}>Per page:</label>
        {/* A closed list, so nothing outside PAGE_SIZE_OPTIONS can reach the
            arithmetic through this control. */}
        <select
          id={pageSizeId}
          value={pageSize}
          onChange={handlePageSizeChange}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Table pagination navigation"
          className={styles.navigationContainer}
        >
          <button
            type="button"
            onClick={handleFirstPage}
            disabled={page === 1}
            title="Go to first page"
            // a11y: named by the action alone, as the sort headers are. A name
            // carrying the position changes under focus, which re-announces the
            // whole control on every press; the live region below is what
            // reports where the user landed.
            aria-label="Go to first page"
            className={styles.navButton}
          >
            <MdFirstPage aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            title="Go to previous page"
            aria-label="Go to previous page"
            className={styles.navButton}
          >
            <MdChevronLeft aria-hidden="true" />
          </button>

          {/* a11y: aria-atomic because React mutates only the page number
              inside this label. Without it the announcement is the bare number,
              and since the controls are named by their action alone this region
              is the only thing that reports where the user landed. */}
          <span
            className={styles.pageInfo}
            aria-live="polite"
            aria-atomic="true"
          >
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            title="Go to next page"
            aria-label="Go to next page"
            className={styles.navButton}
          >
            <MdChevronRight aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleLastPage}
            disabled={page === totalPages}
            title="Go to last page"
            aria-label="Go to last page"
            className={styles.navButton}
          >
            <MdLastPage aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
