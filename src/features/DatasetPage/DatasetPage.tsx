import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from "react";

import {
  INITIAL_APP_STATE,
  applyAppAction,
  type AppAction,
  type AppState,
} from "../../appState";
import type { Column } from "../../components/DataTable/column";
import { DataTable } from "../../components/DataTable/DataTable";
import {
  DEFAULT_TABLE_STATE,
  applyTableAction,
  type TableState,
  type SortDirection,
} from "../../components/DataTable/tableState";
import {
  parseTableState,
  serializeTableState,
} from "../../components/DataTable/tableStateUrl";
import { SearchInput } from "../../components/SearchInput";
// Taken from the shared loader, never from a dataset seam, which would pull
// that dataset into the chunk both entries share.
import { DatasetError } from "../../data/loadEnvelope";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { useLocale } from "../../hooks/useLocale";
import type { Catalog, DomainId } from "../../i18n/catalogs/en";
import { datasetErrorText } from "../../i18n/datasetErrorText";
import { RootLayout } from "../RootLayout";
import { buildSearchLabels, buildTableLabels } from "../tableLabels";
import styles from "./DatasetPage.module.scss";

/** How long typing has to pause before the term is committed. */
const SEARCH_DEBOUNCE_MS = 150;

/**
 * What one dataset page needs. Declare it at module scope, because each
 * function's identity is a memo or effect key.
 */
export interface DatasetConfig<T, Id extends string> {
  readonly domain: DomainId;
  readonly search: (params: {
    readonly searchTerm: string;
  }) => Promise<readonly T[]>;
  readonly buildColumns: (
    catalog: Catalog,
    tag: string,
  ) => readonly Column<T, Id>[];
  readonly getRowId: (row: T) => string;
  readonly columnIds: readonly Id[];
}

interface DatasetPageProps<T, Id extends string> {
  readonly config: DatasetConfig<T, Id>;
}

/** The page's props plus the request state the shell keeps above it. */
interface DatasetViewProps<T, Id extends string> extends DatasetPageProps<
  T,
  Id
> {
  readonly request: AppState<T>;
  readonly dispatch: Dispatch<AppAction<T>>;
}

/**
 * One generic page per dataset. It keeps the fetched rows above the layout's
 * error boundary and renders everything built from the address below it.
 */
export function DatasetPage<T, Id extends string>({
  config,
}: DatasetPageProps<T, Id>) {
  // The row type is supplied here because the initial state is typed over no
  // row, and inference would pin the reducer to that.
  const [request, dispatch] = useReducer(applyAppAction<T>, INITIAL_APP_STATE);

  return (
    <RootLayout domain={config.domain}>
      <DatasetView config={config} request={request} dispatch={dispatch} />
    </RootLayout>
  );
}

/**
 * Owns the fetch, the view state and the address. Under the boundary, so a
 * reset remounts it and re-reads the last committed address.
 *
 * ponytail: only a sort the reader starts is held back. A throwing sort the
 * address already names (a link, or a search or language change re-sorting
 * under it) throws again on reset; resetting to an unsorted view would cover
 * that if it matters.
 */
function DatasetView<T, Id extends string>({
  config,
  request,
  dispatch,
}: DatasetViewProps<T, Id>) {
  // Destructured so every dependency array names a function or a string.
  const { domain, search, buildColumns, getRowId, columnIds } = config;

  // The one place below the header that subscribes to the locale. Everything
  // under src/components/ takes its strings as props.
  const { catalog, tag } = useLocale();

  // The documented exception to module-scope label objects. The table holds
  // this across renders and several entries are closures, so its identity has
  // to move when the locale does and must not move otherwise.
  const labels = useMemo(
    () => buildTableLabels(catalog, domain, tag),
    [catalog, domain, tag],
  );

  // Keyed on the catalog alone, because neither entry weaves a number, so the
  // tag would make no difference to either.
  const searchLabels = useMemo(
    () => buildSearchLabels(catalog, domain),
    [catalog, domain],
  );

  // Keyed on exactly the two values the labels are. An array identity that
  // moved on its own would re-sort fifty thousand rows for nothing.
  const columns = useMemo(
    () => buildColumns(catalog, tag),
    [buildColumns, catalog, tag],
  );

  // Initialized from whatever the address carries, so the first render is
  // already the restored view and the first page never flashes for a frame.
  const [tableState, setTableState] = useState<TableState<Id>>(() => ({
    ...DEFAULT_TABLE_STATE,
    ...parseTableState(window.location.search, columnIds),
  }));

  // The sort last on screen. The address waits for a requested sort to reach
  // it, so a sort that fails across frames never lands in the address.
  const [settledSort, setSettledSort] = useState(() => ({
    sortColumnId: tableState.sortColumnId,
    sortDirection: tableState.sortDirection,
  }));
  const sortPending =
    tableState.sortColumnId !== settledSort.sortColumnId ||
    tableState.sortDirection !== settledSort.sortDirection;

  const handleSortSettled = useCallback(
    (sortColumnId: Id | null, sortDirection: SortDirection | null) => {
      setSettledSort((settled) =>
        settled.sortColumnId === sortColumnId &&
        settled.sortDirection === sortDirection
          ? settled
          : { sortColumnId, sortDirection },
      );
    },
    [],
  );

  // What is in the box, which is not yet what the table was asked for. Seeded
  // from the committed term, so a link carrying one paints it on first render.
  const [searchInput, setSearchInput] = useState(tableState.query);

  const { rows, error, loading, datasetReady, retryAttempt } = request;

  // The committed term has one owner, the view state, so a sort or a page
  // change never re-runs the search.
  const { query } = tableState;

  useEffect(() => {
    // The fetch sits in the effect so this one flag guards every write below.
    // A result arriving after cleanup belongs to a search already moved past.
    let ignore = false;

    // Clear the last failure as the new attempt starts, so a retry does not
    // leave the old error on screen beside the new load.
    dispatch({ type: "attempt" });

    search({ searchTerm: query })
      .then((searchResult) => {
        if (ignore) return;
        dispatch({ type: "resolved", rows: searchResult });
      })
      .catch((err: unknown) => {
        if (ignore) return;
        if (err instanceof Error) {
          dispatch({ type: "failed", error: err });
        } else {
          // A rejection carrying no error, which only a stubbed seam produces.
          // It enters state as a dataset error so a sentence always exists.
          dispatch({
            type: "failed",
            error: new DatasetError(
              "unexpected",
              0,
              "The search rejected with something that was not an error",
            ),
          });
        }
      })
      .finally(() => {
        if (ignore) return;
        dispatch({ type: "settled" });
      });

    return () => {
      ignore = true;
    };
  }, [dispatch, search, query, retryAttempt]);

  // One address is one view, per resolved locale: the query string carries the search
  // term, the sort column and direction, the page and the page size, and the resolved
  // locale is deliberately not among them, so two readers opening the same link see
  // the same rows in the order and the number format their own locale produces.
  // Putting the locale in the address would force the sender's language on the
  // recipient and would make the locale part of the table's view state.
  useEffect(() => {
    // The only address write the page makes: replaceState, never a history
    // push. Skipped while a sort is still on its way to the screen, and when
    // the serialized state already matches.
    if (sortPending) return;
    const next = serializeTableState(tableState, window.location.search);
    if (next === window.location.search) return;

    // An empty query is written as the path, since "" resolves to the current
    // address and keeps the stale query. The fragment rides along either way.
    // Guarded: a browser that rate limits history mutation throws, and a throw
    // in a commit-phase effect would replace the whole view with the fallback.
    try {
      window.history.replaceState(
        window.history.state,
        "",
        next === ""
          ? window.location.pathname + window.location.hash
          : next + window.location.hash,
      );
    } catch {
      // The view state is unchanged and correct; only the address fell behind.
    }
  }, [tableState, sortPending]);

  // The functional updater form keeps these dependency arrays empty.
  const handleSort = useCallback((columnId: Id) => {
    setTableState((state) =>
      applyTableAction(state, { type: "sort", columnId }),
    );
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setTableState((state) => applyTableAction(state, { type: "page", page }));
  }, []);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setTableState((state) =>
      applyTableAction(state, { type: "pageSize", pageSize }),
    );
  }, []);

  // The single point a pause in typing reaches. It moves the view state, which
  // returns the reader to the first page and re-runs the search.
  const commitSearch = useCallback((term: string) => {
    // Trimmed as the address parse trims, so the term in state is canonical
    // whichever way it arrived. The box paints what was typed, separately.
    const settled = term.trim();

    setTableState((state) =>
      applyTableAction(state, { type: "query", query: settled }),
    );
  }, []);

  const { schedule: scheduleSearchCommit, cancel: cancelSearchCommit } =
    useDebouncedCallback(commitSearch, SEARCH_DEBOUNCE_MS);

  // A traversal re-reads the whole view from the address and applies it in one
  // write. Declared after the scheduler, because it has to cancel a commit the
  // scheduler is still holding.
  useEffect(() => {
    const handlePopState = () => {
      // The keystrokes belong to the view the reader has left, so a commit
      // still pending is canceled with it and never lands on the restored view.
      cancelSearchCommit();

      const restored: TableState<Id> = {
        ...DEFAULT_TABLE_STATE,
        ...parseTableState(window.location.search, columnIds),
      };

      setTableState((state) => ({
        ...restored,
        // The one field carried over, because the address does not hold it. A
        // restored sort is still a first render and stays silent.
        hasSorted: state.hasSorted,
      }));

      setSearchInput(restored.query);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [columnIds, cancelSearchCommit]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * a11y: the table replaces the retry control once the request succeeds, so
   * focus moves to the search box first instead of dropping to the body.
   * Deliberately manual: a backoff timer would hide a broken deployment.
   */
  const handleRetry = useCallback(() => {
    searchInputRef.current?.focus();
    dispatch({ type: "retry" });
  }, [dispatch]);

  // The box repaints on every keystroke while the commit waits for the pause.
  const handleSearchChange = useCallback(
    (term: string) => {
      setSearchInput(term);
      scheduleSearchCommit(term);
    },
    [scheduleSearchCommit],
  );

  // Derived during render. The catch sits inside the fetch effect, and reading
  // the catalog there would make the locale a dependency of that effect.
  const errorMessage =
    error === null ? null : datasetErrorText(error, catalog[domain], tag);

  return (
    <>
      <h1>{catalog[domain].appTitle}</h1>
      <div className={styles.container}>
        <SearchInput
          value={searchInput}
          onChange={handleSearchChange}
          labels={searchLabels}
          ref={searchInputRef}
        />
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={getRowId}
          state={tableState}
          onSortChange={handleSort}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          loading={loading}
          datasetReady={datasetReady}
          errorMessage={errorMessage}
          onRetry={handleRetry}
          onSortSettled={handleSortSettled}
          labels={labels}
        />
      </div>
    </>
  );
}
