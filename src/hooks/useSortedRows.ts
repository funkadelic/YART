import { useEffect, useMemo, useState } from "react";

import type { Column } from "../components/DataTable/column";
import {
  cachedSortedRows,
  sortRowsCached,
  storeSortedRows,
} from "../components/DataTable/sortRowsCached";
import { sortRowsSliced } from "../components/DataTable/sortRowsSliced";

/**
 * The largest set sorted inside the render. The full 50,250-row pass measured
 * 324 ms at 4x slowdown, so n log n puts 5,000 rows near 30 ms, with no busy flash.
 */
export const SYNC_SORT_ROWS = 5_000;

/** An order put on screen and the inputs it was sorted from. */
interface Settled<T, Id extends string> {
  readonly rows: readonly T[] | undefined;
  readonly column: Column<T, Id> | undefined;
  readonly direction: "asc" | "desc" | null;
  readonly getRowId: ((row: T) => string) | undefined;
  readonly sorted: readonly T[];
}

/**
 * The sorted rows, and whether a sort is still running. A large cold sort
 * resolves across frames, and the last settled order is shown meanwhile.
 */
export function useSortedRows<T, Id extends string>(
  rows: readonly T[],
  columns: readonly Column<T, Id>[],
  columnId: Id | null,
  direction: "asc" | "desc" | null,
  getRowId: (row: T) => string,
): { sortedRows: readonly T[]; sorting: boolean } {
  const column = columns.find((candidate) => candidate.id === columnId);

  // The order when it is available inside the render, else null.
  const ready = useMemo(() => {
    if (!column || !direction) return rows;
    if (rows.length <= SYNC_SORT_ROWS) {
      return sortRowsCached(rows, column, direction, getRowId);
    }
    return cachedSortedRows(rows, column, direction, getRowId) ?? null;
  }, [rows, column, direction, getRowId]);

  // A failed pass is rethrown during render, so the nearest error boundary catches it.
  const [failure, setFailure] = useState<Error | null>(null);

  const [settled, setSettled] = useState<Settled<T, Id>>(() =>
    ready === null
      ? {
          rows: undefined,
          column: undefined,
          direction: null,
          getRowId: undefined,
          sorted: [],
        }
      : { rows, column, direction, getRowId, sorted: ready },
  );

  const matches =
    settled.rows === rows &&
    settled.column === column &&
    settled.direction === direction &&
    settled.getRowId === getRowId;
  const current = ready ?? (matches ? settled.sorted : null);

  // Adjusted during render, so the next pending sort shows this order.
  if (ready !== null && (ready !== settled.sorted || !matches)) {
    setSettled({ rows, column, direction, getRowId, sorted: ready });
  }

  useEffect(() => {
    // Column and direction are always set when ready is null; checked to narrow.
    if (ready !== null || !column || !direction) return;

    let cancelled = false;
    void sortRowsSliced(
      rows,
      column,
      direction,
      getRowId,
      () => cancelled,
    ).then(
      (sorted) => {
        // A pass that never yielded can finish after its cleanup ran.
        if (!sorted || cancelled) return;
        storeSortedRows(rows, column, direction, getRowId, sorted);
        setSettled({ rows, column, direction, getRowId, sorted });
      },
      (error: unknown) => {
        setFailure(new Error("The sort failed.", { cause: error }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ready, rows, column, direction, getRowId]);

  if (failure) throw failure;

  return { sortedRows: current ?? settled.sorted, sorting: current === null };
}
