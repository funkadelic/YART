import { useCallback, useEffect, useState } from "react";

import type { City } from "../../api/getCities";
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
import {
  CITY_COLUMN_IDS,
  cityColumns,
  cityRowId,
  cityTableLabels,
  type CityColumnId,
} from "./cityColumns";
import styles from "./CityTable.module.scss";

interface CityTableProps {
  readonly data: City[];
  readonly searchTerm: string;
  readonly onSearchChange: (term: string) => void;
  readonly loading: boolean;
  // False until the underlying collection has arrived at least once.
  readonly datasetReady: boolean;
  readonly error: Error | null;
  // Optional so the table stays usable on its own, without a container to
  // re-run the request behind it.
  readonly onRetry?: () => void;
}

/**
 * The city table: the shared table wired to the city columns, the city copy,
 * and the view state that drives them.
 *
 * Everything this application knows about cities that the table has to render
 * is assembled here, which is what leaves the shared component free of it.
 * Searching is reported upward rather than carried out here: the container
 * above owns the term and the request behind it, and which fields a term
 * matches is decided at the data layer.
 */
export function CityTable({
  data,
  searchTerm,
  onSearchChange,
  loading,
  datasetReady,
  error,
  onRetry,
}: CityTableProps) {
  // Initialized with the term the container asked for and whatever the address
  // carries, so the first render is already the restored view: a link naming a
  // page never paints the first one for a frame on the way there. Reading it
  // here rather than in an effect is what buys that, and the initializer is
  // pure, so the development-mode double invoke costs one extra parse.
  //
  // This component holds the view state rather than receiving it the way the
  // shared table does. About forty renders in the accessibility regression
  // suite drive sorting and paging by clicking this component, so hoisting the
  // state would put a stateful wrapper under all of them and the suite would
  // start asserting against the wrapper instead of against the application.
  const [tableState, setTableState] = useState<TableState<CityColumnId>>(
    () => ({
      ...DEFAULT_TABLE_STATE,
      query: searchTerm,
      ...parseTableState(window.location.search, CITY_COLUMN_IDS),
    }),
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

  // The only place in this application that writes the address, and it replaces
  // rather than pushes, so one Back press leaves the site instead of stepping
  // the reader back through positions they never asked to record.
  //
  // The comparison ahead of the write earns four things at once: a link that is
  // already canonical is never rewritten, a parameter stating a default is
  // stripped the moment it arrives, a hostile link is canonicalized on arrival,
  // and a change driven by a back navigation cannot loop, because by then the
  // address already says what the state says.
  useEffect(() => {
    const next = serializeTableState(tableState, window.location.search);
    if (next === window.location.search) return;

    // An empty query has to be written as the path. The empty string resolves
    // to the current address and leaves the stale query exactly where it was,
    // which is a write that reports success and changes nothing. The fragment
    // rides along in both branches because a relative reference carrying a
    // query but no fragment drops the fragment, and a shared link can carry one
    // this application never put there.
    window.history.replaceState(
      window.history.state,
      "",
      next === ""
        ? window.location.pathname + window.location.hash
        : next + window.location.hash,
    );
  }, [tableState]);

  // A history entry this application did not create can still carry a query it
  // owns, so a traversal re-reads the whole view from the address and applies
  // it in one write. Attached and detached symmetrically rather than assigned
  // onto the window, so a second listener cannot silently replace this one.
  useEffect(() => {
    const handlePopState = () => {
      setTableState((state) => ({
        ...DEFAULT_TABLE_STATE,
        ...parseTableState(window.location.search, CITY_COLUMN_IDS),
        // Carried over only because the schema does not own the search key yet;
        // delete this line in the plan that gives it one.
        query: state.query,
        // A restored sort is still a first render, and announcing a sort to
        // someone who has just opened a link announces something that did not
        // just happen. Carrying the flag across means a traversal after a real
        // sort still announces, while a cold one stays silent.
        hasSorted: state.hasSorted,
      }));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // The functional updater form is what keeps these dependency arrays empty, so
  // the three callbacks keep one identity for the life of the table.
  const handleSort = useCallback((columnId: CityColumnId) => {
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

  return (
    <div className={styles.container}>
      <SearchInput
        value={searchTerm}
        onChange={onSearchChange}
        placeholder="Search for a city"
      />
      <DataTable
        rows={data}
        columns={cityColumns}
        getRowId={cityRowId}
        state={tableState}
        onSortChange={handleSort}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
        datasetReady={datasetReady}
        error={error}
        onRetry={onRetry}
        labels={cityTableLabels}
      />
    </div>
  );
}
