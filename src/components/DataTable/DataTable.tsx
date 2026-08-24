import type { Column } from "./column";
import type { TableState } from "./tableState";
import { TableHead } from "./TableHead";
import { TableBody } from "./TableBody";
import { Pagination } from "./Pagination";
import { useSortedRows } from "../../hooks/useSortedRows";
import { usePaginatedRows } from "../../hooks/usePaginatedRows";
import styles from "./DataTable.module.scss";

/**
 * Every rendered string that names what the rows are.
 *
 * They arrive as a prop because a table that renders any collection is the one
 * thing that cannot know what the collection is called, and a shared component
 * carrying one collection's nouns would be shared in name only. Two of the five
 * are functions because they weave counts into a sentence; supplying the object
 * from module scope keeps those two closures stable across renders.
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
}

export interface DataTableProps<T, Id extends string> {
  readonly rows: readonly T[];
  readonly columns: readonly Column<T, Id>[];
  /**
   * Must be injective. It keys the rows for reconciliation and it breaks ties
   * between equal values in the sort, so two rows sharing a value here lose
   * their identity and their ordering in the same stroke.
   */
  readonly getRowId: (row: T) => string;
  // The id is read off the column array above and only checked here. Without
  // the wrapper the compiler would collect a candidate from this prop too and
  // union it in, so a misspelt id would widen the union in silence instead of
  // failing at the line that holds it.
  readonly state: TableState<NoInfer<Id>>;
  readonly onSortChange: (columnId: NoInfer<Id>) => void;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly loading: boolean;
  // False until the underlying collection has arrived at least once.
  readonly datasetReady: boolean;
  readonly error: Error | null;
  // Optional so the table stays usable on its own, without a container to
  // re-run the request behind it.
  readonly onRetry?: () => void;
  readonly labels: DataTableLabels;
}

/**
 * Renders a collection as a sortable, paginated table.
 *
 * It holds nothing. The sort column and direction, the page position, the page
 * size and the committed query all arrive in one object and leave as three
 * calls describing what the user did, so the owner of that object decides what
 * the next one is. Both derivations below are memos over modules that know
 * nothing about React.
 *
 * Ordering and every rendered cell are delegated to the column descriptors, and
 * every string naming what the rows are comes from the labels object, so
 * nothing in this file knows which collection it is showing.
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
  error,
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

  // The announcements name what is on screen, and what is on screen is the
  // column label. state.sortColumnId is the descriptor's id, which is not the name of
  // anything the reader can see.
  const activeLabel = columns.find(
    (column) => column.id === state.sortColumnId,
  )?.label;

  return (
    <>
      {/* a11y: Live region for announcing sort changes */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {state.sortDirection && activeLabel
          ? `Table sorted by ${activeLabel} in ${state.sortDirection === "asc" ? "ascending" : "descending"} order`
          : state.hasSorted
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
          : sortedRows.length === 0
            ? labels.emptyAnnouncement
            : labels.results(paginatedData.length, sortedRows.length)}
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
        <div className={styles.loading}>{labels.loading}</div>
      ) : (
        <>
          {paginatedData.length === 0 ? (
            <div className={styles.noResults}>{labels.empty}</div>
          ) : (
            <>
              <div
                className={`${styles.tableContainer} ${loading ? styles.refreshing : ""}`}
                aria-busy={loading}
              >
                <table className={styles.table}>
                  <caption className={styles.srOnly}>
                    {labels.caption(
                      sortedRows.length,
                      state.sortDirection
                        ? `sorted by ${activeLabel} ${state.sortDirection}ending`
                        : "not sorted",
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
              />
            </>
          )}
        </>
      )}
    </>
  );
}
