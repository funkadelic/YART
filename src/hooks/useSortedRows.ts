import { useMemo } from "react";

import type { Column } from "../components/DataTable/column";
import { sortRows } from "../components/DataTable/sortRows";

/** Memoizes the sorted rows. A column array rebuilt each render re-sorts. */
export function useSortedRows<T, Id extends string>(
  rows: readonly T[],
  columns: readonly Column<T, Id>[],
  columnId: Id | null,
  direction: "asc" | "desc" | null,
  getRowId: (row: T) => string,
): readonly T[] {
  return useMemo(
    () =>
      sortRows(
        rows,
        columns.find((column) => column.id === columnId),
        direction,
        getRowId,
      ),
    [rows, columns, columnId, direction, getRowId],
  );
}
