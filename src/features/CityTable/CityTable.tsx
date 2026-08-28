import { useCallback, useEffect, useMemo, useState } from "react";

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
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { useLocale } from "../../hooks/useLocale";
import { buildTableLabels } from "./cityLabels";
import {
  CITY_COLUMN_IDS,
  buildCityColumns,
  cityRowId,
  type CityColumnId,
} from "./cityColumns";
import styles from "./CityTable.module.scss";

/**
 * How long typing has to pause before the term is committed. The window is the
 * one the container applied before this component took the search box over, so
 * the move retunes nothing.
 */
const SEARCH_DEBOUNCE_MS = 150;

interface CityTableProps {
  readonly data: City[];
  // Receives the committed term, meaning one call per pause in typing rather
  // than one per keystroke.
  readonly onSearchChange: (term: string) => void;
  readonly loading: boolean;
  // False until the underlying collection has arrived at least once.
  readonly datasetReady: boolean;
  // The text of the failure rather than the failure itself, which is the shape
  // the table below takes: nothing under this component narrows an error, so a
  // preserved cause cannot reach a reader by accident.
  readonly errorMessage: string | null;
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
 * The search box belongs to this component: it holds what is being typed and
 * the term that typing settles on, and it reports the settled term upward so
 * the container can issue the request behind it. Which fields a term matches is
 * still decided at the data layer.
 */
export function CityTable({
  data,
  onSearchChange,
  loading,
  datasetReady,
  errorMessage,
  onRetry,
}: CityTableProps) {
  // The one place below the header that subscribes to the locale. Everything
  // under src/components/ takes its strings as props and never learns that a
  // locale exists, which is what keeps the shared table shared.
  const { catalog, tag } = useLocale();

  // The deliberate exception to the rule that label objects are built at module
  // scope. The table holds this object across renders and two of its entries are
  // closures, so its identity has to change when the locale does and must not
  // change otherwise. That is exactly what a memo keyed on the catalog and the
  // tag gives, and a module-scope constant cannot give it at all.
  const labels = useMemo(() => buildTableLabels(catalog, tag), [catalog, tag]);

  // The other documented exception to module-scope construction, and it keys on
  // exactly the two values the labels above key on. That is a requirement
  // rather than a symmetry: a column array whose identity moved on a render
  // where the labels did not would re-sort the whole collection and re-slice
  // the page for nothing, which over fifty thousand rows is the most expensive
  // thing this component can do by accident.
  const columns = useMemo(() => buildCityColumns(catalog, tag), [catalog, tag]);

  // Initialized from whatever the address carries, so the first render is
  // already the restored view: a link naming a page never paints the first one
  // for a frame on the way there. Reading it here rather than in an effect is
  // what buys that, and the initializer is pure, so the development-mode double
  // invoke costs one extra parse.
  //
  // This component holds the view state rather than receiving it the way the
  // shared table does, and the reason is measured rather than stylistic. About
  // forty renders in the integration suite drive sorting and paging by clicking
  // this component, and that suite is the accessibility regression record
  // carried forward from an earlier phase. Hoisting the state would put a
  // stateful wrapper under every one of them, at which point the suite asserts
  // against the wrapper rather than against the application. Four test edits
  // against roughly forty is the whole of the argument.
  const [tableState, setTableState] = useState<TableState<CityColumnId>>(
    () => ({
      ...DEFAULT_TABLE_STATE,
      ...parseTableState(window.location.search, CITY_COLUMN_IDS),
    }),
  );

  // What is currently in the box, which is not yet what the table has been
  // asked for. Seeded from the committed term, which the initializer above has
  // already read out of the address, so a link carrying a term paints that term
  // on the first render rather than filling the box in after mount. Declared
  // next to the state it settles into so a reader meets the pair together.
  const [searchInput, setSearchInput] = useState(tableState.query);

  // The only place in this application that writes the address, and it replaces
  // rather than pushes, so one Back press leaves the site instead of stepping
  // the reader back through positions they never asked to record.
  //
  // The comparison ahead of the write earns four things at once: a link that is
  // already canonical is never rewritten, a parameter stating a default is
  // stripped the moment it arrives, a hostile link is canonicalized on arrival,
  // and a change driven by a back navigation cannot loop, because by then the
  // address already says what the state says.
  //
  // One address is one view, per resolved locale: the query string carries
  // the search term, the sort column and direction, the page and the page
  // size, and the resolved locale is deliberately not among them, so two
  // readers opening the same link see the same rows in the order and the
  // number format their own locale produces. Putting the locale in the
  // address would force the sender's language on the recipient and would
  // make the locale part of the table's view state.
  useEffect(() => {
    const next = serializeTableState(tableState, window.location.search);
    if (next === window.location.search) return;

    // An empty query has to be written as the path. The empty string resolves
    // to the current address and leaves the stale query exactly where it was,
    // which is a write that reports success and changes nothing. The fragment
    // rides along in both branches because a relative reference carrying a
    // query but no fragment drops the fragment, and a shared link can carry one
    // this application never put there.
    //
    // Guarded because no write to the address is worth the table. Browsers rate
    // limit history mutation and throw rather than ignoring the call, and a held
    // Enter key on the paging control reaches that ceiling in seconds over a
    // collection with thousands of pages. A throw here is a throw in a
    // commit-phase effect, so the boundary above would replace the whole view
    // with the failure fallback over a link that failed to update.
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

  // This one carries a dependency where the three above carry none, so its
  // identity is an argument rather than a guarantee: the only thing it depends
  // on is the parent's callback, and that callback is itself memoized with an
  // empty array, so in practice it is as stable as the three. Nothing below it
  // inherits that argument, because the debounce reads its callback out of a
  // ref rather than closing over it.
  //
  // Committing is the single point a pause in typing reaches. It moves the view
  // state, which returns the reader to the first page because a new term is a
  // different set of rows rather than a narrowing of the current one, and it
  // reports the term upward so the request behind it is reissued.
  const commitSearch = useCallback(
    (term: string) => {
      // Canonicalized here, once, rather than at each of the three places that
      // decide whether two terms are the same view. The search trims before it
      // matches and the address trims before it writes, so a term differing
      // only in edge whitespace selects the same rows at the same address;
      // committing it verbatim is what makes the state disagree with both of
      // them, and the disagreement costs the reader their position, strips the
      // page from the address, and reissues a request for rows that did not
      // change. The box goes on painting what was typed, because what is being
      // typed is separate state from what typing settles on.
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

  // A history entry this application did not create can still carry a query it
  // owns, so a traversal re-reads the whole view from the address and applies
  // it in one write. Attached and detached symmetrically rather than assigned
  // onto the window, so a second listener cannot silently replace this one.
  //
  // Declared after the scheduler rather than beside the write above, because it
  // has to be able to cancel a commit the scheduler is still holding, and a
  // dependency array is read during the render that declares it.
  useEffect(() => {
    const handlePopState = () => {
      // A traversal landing inside the debounce window would otherwise let the
      // term the reader typed a moment ago land on top of the view they just
      // navigated back to: the box would show the restored term while the rows,
      // the position, and the address all carried the typed one. The keystrokes
      // belong to the view the reader has left, so the commit goes with it.
      cancelSearchCommit();

      const restored: TableState<CityColumnId> = {
        ...DEFAULT_TABLE_STATE,
        ...parseTableState(window.location.search, CITY_COLUMN_IDS),
      };

      setTableState((state) => ({
        ...restored,
        // A restored sort is still a first render, and announcing a sort to
        // someone who has just opened a link announces something that did not
        // just happen. Carrying the flag across means a traversal after a real
        // sort still announces, while a cold one stays silent. It is the one
        // field carried over, because it is the one field the address does not
        // and will not hold.
        hasSorted: state.hasSorted,
      }));

      // The box and the request behind it both follow the term the traversal
      // landed on. Reporting it upward rather than letting the container read
      // the address for itself keeps the single writer single and the reader
      // count at two, and it is why this handler depends on the parent's
      // callback where the three above depend on nothing.
      setSearchInput(restored.query);
      onSearchChange(restored.query);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [onSearchChange, cancelSearchCommit]);

  // The box repaints on every keystroke while the commit waits for the pause,
  // so typing stays responsive and the table is asked once for what was typed.
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
        placeholder="Search for a city"
      />
      <DataTable
        rows={data}
        columns={columns}
        getRowId={cityRowId}
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
