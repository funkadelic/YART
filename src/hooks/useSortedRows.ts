import { useMemo } from "react";

import type { Column } from "../components/DataTable/column";
import { sortRows } from "../components/DataTable/sortRows";

/**
 * Memoizes the sorted rows, resolving the active column id to its descriptor
 * inside the memo so the caller passes an id rather than a descriptor it would
 * otherwise have to look up and keep stable itself.
 *
 * Every argument is a dependency, so a caller that rebuilds the column array or
 * the identity function on each render defeats the memo and re-sorts the whole
 * collection on every keystroke. Both belong at module scope.
 */
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
