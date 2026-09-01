import type { Column } from "./column";
import styles from "./DataTable.module.scss";

interface TableBodyProps<T, Id extends string> {
  readonly rows: readonly T[];
  readonly columns: readonly Column<T, Id>[];
  readonly getRowId: (row: T) => string;
}

/** The data rows, each cell produced by its own column's renderer. */
export function TableBody<T, Id extends string>({
  rows,
  columns,
  getRowId,
}: TableBodyProps<T, Id>) {
  return (
    <tbody>
      {rows.map((row) => (
        <tr key={getRowId(row)}>
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
