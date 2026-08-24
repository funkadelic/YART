import { useCallback, useState } from "react";

import type { City } from "../../api/getCities";
import { DataTable } from "../../components/DataTable/DataTable";
import {
  DEFAULT_TABLE_STATE,
  applyTableAction,
  type TableState,
} from "../../components/DataTable/tableState";
import { SearchInput } from "../../components/SearchInput";
import { cityColumns, cityTableLabels, type CityColumnId } from "./cityColumns";
import styles from "./CityTable.module.scss";

// Row identity, as text, because that is what the sort module's tiebreak
// compares. City ids are unique by construction at the parse boundary.
const cityRowId = (city: City) => String(city.id);

interface CityTableProps {
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
  // Initialised with the term already in place, so the first render is the
  // table the container asked for rather than one that resets itself on mount.
  const [tableState, setTableState] = useState<TableState<CityColumnId>>(
    () => ({ ...DEFAULT_TABLE_STATE, query: searchTerm }),
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
