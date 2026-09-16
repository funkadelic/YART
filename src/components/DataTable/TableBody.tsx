import type { Column } from "./column";
import styles from "./DataTable.module.scss";

interface TableBodyProps<T, Id extends string> {
  readonly rows: readonly T[];
  readonly columns: readonly Column<T, Id>[];
  readonly getRowId: (row: T) => string;
  /** The aria-rowindex of this page's first row, counted from the whole set. */
  readonly firstRowIndex: number;
}

/** The data rows, each cell produced by its own column's renderer. */
export function TableBody<T, Id extends string>({
  rows,
  columns,
  getRowId,
  firstRowIndex,
}: TableBodyProps<T, Id>) {
  return (
    <tbody>
      {rows.map((row, index) => (
        <tr key={getRowId(row)} aria-rowindex={firstRowIndex + index}>
          {columns.map((column) => (
            <td
              key={column.id}
              className={column.numeric ? styles.numeric : undefined}
            >
              {column.renderCell(row)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
