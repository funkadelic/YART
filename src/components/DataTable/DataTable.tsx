import type { ReactNode } from "react";
import type { Column } from "./column";
import type { TableState } from "./tableState";
import { TableHead } from "./TableHead";
import { TableBody } from "./TableBody";
import { Pagination, type PaginationLabels } from "./Pagination";
import { useSortedRows } from "../../hooks/useSortedRows";
import { usePaginatedRows } from "../../hooks/usePaginatedRows";
import styles from "./DataTable.module.scss";

export type { PaginationLabels };

/**
 * Every string this table and the controls under it render. The entries that
 * weave a value take that value and never a word, which would decide grammar.
 */
export interface DataTableLabels {
  /** Shown in place of the whole view until the rows have arrived once. */
  readonly loading: string;
  /** Replaces the table when a search matched nothing. */
  readonly empty: string;
  /** What the results region announces for that same empty result. */
  readonly emptyAnnouncement: string;
  /** The rendered count and the matched count, as a sentence. */
  readonly results: (shown: number, total: number) => string;
  /** The row count and an already-composed description of the sort. */
  readonly caption: (total: number, sortSummary: string) => string;
  /** The failure, with the message the request produced woven into it. */
  readonly error: (message: string) => string;
  /** Names the control that reissues a failed request. */
  readonly retry: string;
  /** What the sort region announces once a column is sorted. */
  readonly sortedAnnouncement: (
    columnLabel: string,
    direction: "asc" | "desc",
  ) => string;
  /** What it announces when a sort is taken off again. */
  readonly sortClearedAnnouncement: string;
  /** The caption's phrase for a table nothing is sorted by. */
  readonly unsorted: string;
  /** The caption's phrase for a table sorted by a column. */
  readonly sortSummary: (
    columnLabel: string,
    direction: "asc" | "desc",
  ) => string;
  /** Handed on whole to the page controls below the table. */
  readonly pagination: PaginationLabels;
}

export interface DataTableProps<T, Id extends string> {
  readonly rows: readonly T[];
  readonly columns: readonly Column<T, Id>[];
  /** Must be injective: it keys the rows and breaks ties in the sort. */
  readonly getRowId: (row: T) => string;
  // The id is read off the column array above and only checked here. Without
  // the NoInfer wrapper the compiler would collect a candidate from this prop
  // too and union it in, so a misspelt id would widen the union in silence
  // instead of failing at the line that holds it.
  readonly state: TableState<NoInfer<Id>>;
  readonly onSortChange: (columnId: NoInfer<Id>) => void;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly loading: boolean;
  // False until the underlying collection has arrived at least once.
  readonly datasetReady: boolean;
  // The text of the failure rather than the failure itself, so no component
  // tier sees a cause.
  readonly errorMessage: string | null;
  // Optional so the table stays usable without a container behind it.
  readonly onRetry?: (() => void) | undefined;
  readonly labels: DataTableLabels;
}

/**
 * The failure, in place of the table.
 *
 * a11y: the failure arrives after the initial render, so without a live region
 * a screen reader user is never told the load failed or that a way back is on
 * offer. alert rather than status because the table it replaces is gone.
 */
function ErrorRegion({
  message,
  labels,
  onRetry,
}: {
  readonly message: string;
  readonly labels: DataTableLabels;
  readonly onRetry?: (() => void) | undefined;
}) {
  return (
    <div className={styles.error} role="alert">
      {labels.error(message)}
      {onRetry ? (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          {labels.retry}
        </button>
      ) : null}
    </div>
  );
}

/** A link can carry a sort nobody pressed, so hasSorted gates the first. */
function sortAnnouncement(
  labels: DataTableLabels,
  sortDirection: "asc" | "desc" | null,
  hasSorted: boolean,
  activeLabel: string,
): string {
  if (!hasSorted) return "";
  if (sortDirection && activeLabel) {
    // The direction travels as the value it is, not as a word chosen here:
    // which word it becomes is a fact about a language.
    return labels.sortedAnnouncement(activeLabel, sortDirection);
  }
  return labels.sortClearedAnnouncement;
}

/** Silent unless settled: a count mid-request names rows about to go. */
function resultsAnnouncement(
  labels: DataTableLabels,
  settled: boolean,
  shown: number,
  total: number,
): string {
  if (!settled) return "";
  if (total === 0) return labels.emptyAnnouncement;
  return labels.results(shown, total);
}

/** The sort described for the caption, in the caption's words, not the region's. */
function sortSummary(
  labels: DataTableLabels,
  sortDirection: "asc" | "desc" | null,
  activeLabel: string,
): string {
  if (!sortDirection) return labels.unsorted;
  return labels.sortSummary(activeLabel, sortDirection);
}

/**
 * Renders a collection as a sortable, paginated table, holding nothing itself.
 * Cells come from the descriptors and words from the labels, so nothing here
 * knows which collection it is showing.
 */
export function DataTable<T, Id extends string>({
  rows,
  columns,
  getRowId,
  state,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  loading,
  datasetReady,
  errorMessage,
  onRetry,
  labels,
}: DataTableProps<T, Id>) {
  const sortedRows = useSortedRows(
    rows,
    columns,
    state.sortColumnId,
    state.sortDirection,
    getRowId,
  );

  const { paginatedData, totalPages, effectivePage } = usePaginatedRows(
    sortedRows,
    state.page,
    state.pageSize,
  );

  // The announcements name the column label, not the descriptor's id. Empty
  // rather than absent, so the composers below always hand over a string.
  const activeLabel =
    columns.find((column) => column.id === state.sortColumnId)?.label ?? "";

  // The four views the table can show. The order is the precedence: a failure
  // outranks a pending load, and both outrank a result.
  let body: ReactNode;
  if (errorMessage !== null) {
    body = (
      <ErrorRegion message={errorMessage} labels={labels} onRetry={onRetry} />
    );
  } else if (!datasetReady) {
    // Gated on datasetReady rather than loading, or the empty-result copy
    // would claim a search matched nothing before one was made.
    body = <div className={styles.loading}>{labels.loading}</div>;
  } else if (paginatedData.length === 0) {
    body = <div className={styles.noResults}>{labels.empty}</div>;
  } else {
    body = (
      <>
        <div
          className={`${styles.tableContainer} ${loading ? styles.refreshing : ""}`}
          aria-busy={loading}
        >
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              {labels.caption(
                sortedRows.length,
                sortSummary(labels, state.sortDirection, activeLabel),
              )}
            </caption>
            <TableHead
              columns={columns}
              sortColumnId={state.sortColumnId}
              sortDirection={state.sortDirection}
              onSortChange={onSortChange}
            />
            <TableBody
              rows={paginatedData}
              columns={columns}
              getRowId={getRowId}
            />
          </table>
        </div>

        <Pagination
          page={effectivePage}
          totalPages={totalPages}
          pageSize={state.pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          labels={labels.pagination}
        />
      </>
    );
  }

  return (
    <>
      {/* a11y: Live region for announcing sort changes */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {sortAnnouncement(
          labels,
          state.sortDirection,
          state.hasSorted,
          activeLabel,
        )}
      </div>
      {/* a11y: mounted unconditionally rather than inside the branch that
          renders the table. A live region created with its message already in
          it announces nothing, which would drop the first row count on a cold
          start and again after a successful retry. The empty result gets a
          sentence of its own for the same reason in reverse: emptying a region
          is not an announcement either, so a search matching no rows would be
          indistinguishable from a request that never came back. */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {resultsAnnouncement(
          labels,
          errorMessage === null && !loading && datasetReady,
          paginatedData.length,
          sortedRows.length,
        )}
      </div>

      {body}
    </>
  );
}
