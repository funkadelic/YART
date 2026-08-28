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
 * Every string this table and the controls under it render.
 *
 * They arrive as a prop because a table that renders any collection is the one
 * thing that cannot know what the collection is called, and a shared component
 * carrying one collection's nouns would be shared in name only. The same
 * argument is what grew the object from the five entries it opened with to every
 * word below: a component holding one reader's language is shared in name only
 * too. Nothing in this file is a literal a reader sees.
 *
 * Several entries are functions because they weave a value into a sentence.
 * None of them takes a word: a caller handing over an already-composed phrase
 * has made the grammatical decision one layer too early, which is exactly the
 * defect the two sort entries below were rewritten to remove. The object is
 * expected to hold one identity per language, so those closures stay stable
 * across renders.
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
  // The text of the failure rather than the failure itself. A component tier
  // that renders a message cannot narrow an error object, which also means a
  // preserved cause has no path to the screen from here.
  readonly errorMessage: string | null;
  // Optional so the table stays usable on its own, without a container to
  // re-run the request behind it.
  readonly onRetry?: (() => void) | undefined;
  readonly labels: DataTableLabels;
}

/**
 * The failure, in place of the table.
 *
 * a11y: the failure arrives after the initial render, so without a live region
 * a screen reader user is never told the load failed or that a way back is on
 * offer. alert rather than status because the table it replaces is gone.
 *
 * A failed dataset load makes every search fail, so the way back belongs in the
 * region that already reports it rather than in a second error surface. A
 * native button carries the role, the focus, and the keyboard activation on its
 * own.
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

/**
 * What the sort live region says.
 *
 * A cleared sort and a sort that has never been applied render the same state,
 * so the first render has to stay silent while the press that clears a sort
 * does not. That is what hasSorted separates.
 *
 * It separates the sorted case too, not just the cleared one: a sort can arrive
 * without anybody pressing anything, because a link can carry one. That is
 * still a first render, and a region reporting what the table is rather than
 * what just changed announces something that did not happen.
 */
function sortAnnouncement(
  labels: DataTableLabels,
  sortDirection: "asc" | "desc" | null,
  hasSorted: boolean,
  activeLabel: string,
): string {
  if (!hasSorted) return "";
  if (sortDirection && activeLabel) {
    // The direction travels as the value it is rather than as a word chosen
    // here. The word it turns into is a fact about a language, and the
    // suffixed token this replaced was a word in exactly one of them.
    return labels.sortedAnnouncement(activeLabel, sortDirection);
  }
  return labels.sortClearedAnnouncement;
}

/**
 * What the results live region says.
 *
 * Silent unless there is a settled result to report, because announcing a count
 * mid-request would name rows that are about to be replaced. The empty result
 * gets a sentence of its own: emptying a region is not an announcement, so a
 * search matching nothing would otherwise be indistinguishable from a request
 * that never came back.
 */
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

/**
 * The sort, described for the caption, in the words the caption weaves into a
 * sentence rather than the words the live region announces.
 */
function sortSummary(
  labels: DataTableLabels,
  sortDirection: "asc" | "desc" | null,
  activeLabel: string,
): string {
  if (!sortDirection) return labels.unsorted;
  return labels.sortSummary(activeLabel, sortDirection);
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

  // The announcements name what is on screen, and what is on screen is the
  // column label. state.sortColumnId is the descriptor's id, which is not the name of
  // anything the reader can see.
  // Empty rather than absent when no column matches, so the two composers
  // below hand a string to the catalog. The empty string is falsy exactly
  // where the missing label was, which is what the announcement's guard reads.
  const activeLabel =
    columns.find((column) => column.id === state.sortColumnId)?.label ?? "";

  // The four views the table can show, chosen once here rather than through a
  // stack of conditional expressions inside the markup. The order is the
  // precedence: a failure outranks a pending load, and both outrank a result.
  let body: ReactNode;
  if (errorMessage !== null) {
    body = (
      <ErrorRegion message={errorMessage} labels={labels} onRetry={onRetry} />
    );
  } else if (!datasetReady) {
    // The whole view is replaced until the collection has arrived once, the
    // first paint before the request even starts included: the empty result
    // copy would otherwise claim a search had been made and matched nothing.
    // Once the collection has arrived, a refetch keeps the table mounted so it
    // does not unmount and flash on every keystroke.
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
