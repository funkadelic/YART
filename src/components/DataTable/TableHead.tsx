import { FiChevronUp, FiChevronDown } from "react-icons/fi";

import type { Column } from "./column";
import tableStyles from "./DataTable.module.scss";
import styles from "./TableHead.module.scss";

interface TableHeadProps<T, Id extends string> {
  readonly columns: readonly Column<T, Id>[];
  readonly sortColumnId: Id | null;
  readonly sortDirection: "asc" | "desc" | null;
  readonly onSortChange: (columnId: Id) => void;
}

/**
 * The header cell's sort state, in the three values the attribute accepts.
 *
 * Every column carries one: a sortable column that is not the active one
 * reports "none" rather than omitting the attribute, so assistive technology
 * describes it as sortable-but-unsorted instead of not sortable at all.
 */
function ariaSort(
  direction: "asc" | "desc" | null,
): "ascending" | "descending" | "none" {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

/**
 * The header row: one cell per column, each carrying the control that cycles
 * the sort and the state the cycle is currently in.
 *
 * Everything rendered here comes from the descriptor, so this component names
 * no field of the row type it orders. The width the descriptor may carry is
 * applied as a style object rather than interpolated into an attribute, which
 * is what keeps an author-supplied string off the attribute itself.
 */
export function TableHead<T, Id extends string>({
  columns,
  sortColumnId,
  sortDirection,
  onSortChange,
}: TableHeadProps<T, Id>) {
  return (
    <thead>
      <tr>
        {columns.map((column) => {
          const isActive = sortColumnId === column.id;
          const columnDirection = isActive ? sortDirection : null;

          return (
            <th
              key={column.id}
              scope="col"
              className={column.numeric ? tableStyles.numeric : undefined}
              style={{ width: column.width }}
              aria-sort={ariaSort(columnDirection)}
            >
              {
                // a11y: the accessible name is the column label alone, so the
                // control keeps one identity across presses. The sort state is
                // carried by the header cell's own attribute, where the
                // specification puts it, and announced by the live region
                // outside this component. The button handles Enter and Space
                // itself; a manual key handler alongside it would fire twice.
                <button
                  type="button"
                  className={
                    column.numeric
                      ? `${styles.sortButton} ${styles.sortButtonNumeric}`
                      : styles.sortButton
                  }
                  onClick={() => onSortChange(column.id)}
                >
                  {column.label}
                  {columnDirection === "asc" && (
                    <FiChevronUp aria-hidden="true" />
                  )}
                  {columnDirection === "desc" && (
                    <FiChevronDown aria-hidden="true" />
                  )}
                </button>
              }
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
