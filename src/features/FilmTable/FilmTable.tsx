import { useCallback, useEffect, useMemo, useState } from "react";

import type { Film } from "../../api/getFilms";
import { DataTable } from "../../components/DataTable/DataTable";
import {
  DEFAULT_TABLE_STATE,
  applyTableAction,
  type TableState,
} from "../../components/DataTable/tableState";
import {
  parseTableState,
  serializeTableState,
} from "../../components/DataTable/tableStateUrl";
import { SearchInput } from "../../components/SearchInput";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { useLocale } from "../../hooks/useLocale";
import { buildSearchLabels, buildTableLabels } from "../tableLabels";
import {
  FILM_COLUMN_IDS,
  buildFilmColumns,
  filmRowId,
  type FilmColumnId,
} from "./filmColumns";
import styles from "./FilmTable.module.scss";

/** How long typing has to pause before the term is committed. */
const SEARCH_DEBOUNCE_MS = 150;

interface FilmTableProps {
  readonly data: readonly Film[];
  // Receives the committed term, meaning one call per pause in typing rather
  // than one per keystroke.
  readonly onSearchChange: (term: string) => void;
  readonly loading: boolean;
  // False until the underlying collection has arrived at least once.
  readonly datasetReady: boolean;
  // The text of the failure rather than the failure itself, so nothing below
  // this component narrows an error and a cause cannot reach a reader.
  readonly errorMessage: string | null;
  // Optional so the table stays usable without a container behind it.
  readonly onRetry?: () => void;
}

/**
 * The shared table wired to the film columns, the film copy and the view state
 * that drives them. The search box belongs here: it holds what is being typed
 * and the term typing settles on, and reports the settled term upward.
 */
export function FilmTable({
  data,
  onSearchChange,
  loading,
  datasetReady,
  errorMessage,
  onRetry,
}: FilmTableProps) {
  // The one place below the header that subscribes to the locale. Everything
  // under src/components/ takes its strings as props.
  const { catalog, tag } = useLocale();

  // The documented exception to module-scope label objects: the table holds
  // this across renders and several entries are closures, so its identity has
  // to move when the locale does and must not move otherwise.
  const labels = useMemo(
    () => buildTableLabels(catalog, "films", tag),
    [catalog, tag],
  );

  // Keyed on the catalog alone, because neither entry weaves a number and the
  // tag decides nothing here.
  const searchLabels = useMemo(
    () => buildSearchLabels(catalog, "films"),
    [catalog],
  );

  // Keyed on exactly the two values the labels are, and that is a requirement
  // rather than a symmetry: an array identity that moved on its own would
  // re-sort the whole collection for nothing.
  const columns = useMemo(() => buildFilmColumns(catalog, tag), [catalog, tag]);

  // Initialized from whatever the address carries, so the first render is
  // already the restored view rather than the first page for a frame.
  const [tableState, setTableState] = useState<TableState<FilmColumnId>>(
    () => ({
      ...DEFAULT_TABLE_STATE,
      ...parseTableState(window.location.search, FILM_COLUMN_IDS),
    }),
  );

  // What is in the box, which is not yet what the table was asked for. Seeded
  // from the committed term, so a link carrying one paints it on first render.
  const [searchInput, setSearchInput] = useState(tableState.query);

  // The second of the two places in this application that write the address,
  // one per page, and it replaces rather than pushes. The two pages are
  // separate documents and never share a query string. The account of what a
  // link does and does not reproduce is stated once, on the city container, and
  // it holds here unchanged.
  useEffect(() => {
    const next = serializeTableState(tableState, window.location.search);
    if (next === window.location.search) return;

    // An empty query is written as the path: the empty string resolves to the
    // current address and leaves the stale query where it was. The fragment
    // rides along in both branches or a relative reference would drop it.
    //
    // Guarded because no write to the address is worth the table. A browser
    // that rate limits history mutation throws, and a throw in a commit-phase
    // effect would replace the whole view with the failure fallback.
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
  }, [tableState]);

  // The functional updater form is what keeps these dependency arrays empty.
  const handleSort = useCallback((columnId: FilmColumnId) => {
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

  // The single point a pause in typing reaches: it moves the view state, which
  // returns the reader to the first page, and reports the term upward. Its one
  // dependency does not reach the debounce, which reads its callback from a ref.
  const commitSearch = useCallback(
    (term: string) => {
      // Canonicalized once here, because the search trims before it matches
      // and the address trims before it writes. The box goes on painting what
      // was typed, which is separate state from what typing settles on.
      const settled = term.trim();

      setTableState((state) =>
        applyTableAction(state, { type: "query", query: settled }),
      );
      onSearchChange(settled);
    },
    [onSearchChange],
  );

  const { schedule: scheduleSearchCommit, cancel: cancelSearchCommit } =
    useDebouncedCallback(commitSearch, SEARCH_DEBOUNCE_MS);

  // A traversal re-reads the whole view from the address and applies it in one
  // write. Declared after the scheduler, because it has to cancel a commit the
  // scheduler is still holding.
  useEffect(() => {
    const handlePopState = () => {
      // The keystrokes belong to the view the reader has left, so a commit
      // still pending goes with it rather than landing on the restored view.
      cancelSearchCommit();

      const restored: TableState<FilmColumnId> = {
        ...DEFAULT_TABLE_STATE,
        ...parseTableState(window.location.search, FILM_COLUMN_IDS),
      };

      setTableState((state) => ({
        ...restored,
        // The one field carried over, because it is the one the address does
        // not hold: a restored sort is still a first render and stays silent.
        hasSorted: state.hasSorted,
      }));

      // Reported upward rather than read from the address by the container,
      // which is what keeps the reader count at two.
      setSearchInput(restored.query);
      onSearchChange(restored.query);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [onSearchChange, cancelSearchCommit]);

  // The box repaints on every keystroke while the commit waits for the pause.
  const handleSearchChange = useCallback(
    (term: string) => {
      setSearchInput(term);
      scheduleSearchCommit(term);
    },
    [scheduleSearchCommit],
  );

  return (
    <div className={styles.container}>
      <SearchInput
        value={searchInput}
        onChange={handleSearchChange}
        labels={searchLabels}
      />
      <DataTable
        rows={data}
        columns={columns}
        getRowId={filmRowId}
        state={tableState}
        onSortChange={handleSort}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
        datasetReady={datasetReady}
        errorMessage={errorMessage}
        onRetry={onRetry}
        labels={labels}
      />
    </div>
  );
}
