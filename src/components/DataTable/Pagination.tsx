import { useId } from "react";
import {
  MdFirstPage,
  MdLastPage,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";

import { PAGE_SIZE_OPTIONS } from "./tableState";
import styles from "./Pagination.module.scss";

/** Each action entry is read twice, as tooltip and as accessible name. */
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
  readonly labels: PaginationLabels;
}

/** The page-size control and the page navigation, and no other view state. */
export function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  labels,
}: PaginationProps) {
  // Derived, so two tables on one page do not label each other's select.
  const pageSizeId = useId();

  /** The option list is closed, so the parse cannot yield an unusable size. */
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onPageSizeChange(Number.parseInt(e.target.value, 10));
  };

  // a11y: aria-disabled rather than disabled, so a control reaching either end
  // keeps focus; the handlers ignore the press instead.
  const atFirstPage = page === 1;
  const atLastPage = page === totalPages;

  /** Jumps to the first page. */
  const handleFirstPage = () => {
    if (!atFirstPage) onPageChange(1);
  };

  /** Steps one page back. */
  const handlePreviousPage = () => {
    if (!atFirstPage) onPageChange(page - 1);
  };

  /** Steps one page on. */
  const handleNextPage = () => {
    if (!atLastPage) onPageChange(page + 1);
  };

  /** Jumps to the last page that exists for the current row count. */
  const handleLastPage = () => {
    if (!atLastPage) onPageChange(totalPages);
  };

  return (
    <div className={styles.paginationContainer}>
      <div className={styles.pageSizeContainer}>
        <label htmlFor={pageSizeId}>{labels.pageSize}</label>
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
          aria-label={labels.navigation}
          className={styles.navigationContainer}
        >
          <button
            type="button"
            onClick={handleFirstPage}
            aria-disabled={atFirstPage}
            title={labels.firstPage}
            // a11y: named by the action alone, as the sort headers are. A name
            // carrying the position changes under focus, which re-announces the
            // whole control on every press; the live region below reports the
            // new position.
            aria-label={labels.firstPage}
            className={styles.navButton}
          >
            <MdFirstPage aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handlePreviousPage}
            aria-disabled={atFirstPage}
            title={labels.previousPage}
            aria-label={labels.previousPage}
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
            {labels.pageStatus(page, totalPages)}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            aria-disabled={atLastPage}
            title={labels.nextPage}
            aria-label={labels.nextPage}
            className={styles.navButton}
          >
            <MdChevronRight aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleLastPage}
            aria-disabled={atLastPage}
            title={labels.lastPage}
            aria-label={labels.lastPage}
            className={styles.navButton}
          >
            <MdLastPage aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
