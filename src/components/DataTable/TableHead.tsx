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

/** An inactive column reports "none" rather than omitting the attribute. */
function ariaSort(
  direction: "asc" | "desc" | null,
): "ascending" | "descending" | "none" {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

/** The header row. The width is a style object, not an interpolation. */
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
