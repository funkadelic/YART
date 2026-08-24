import type { Column } from "./column";

interface TableBodyProps<T, Id extends string> {
  readonly rows: readonly T[];
  readonly columns: readonly Column<T, Id>[];
  readonly getRowId: (row: T) => string;
}

/**
 * The data rows: one row per element, one cell per column, each cell produced
 * by that column's own renderer.
 *
 * The renderer's return value is inserted as a child, which the framework
 * escapes, and the default renderer stringifies the value. That is the whole
 * defence for a cell slot an author controls, and it is enough only for as long
 * as no raw-markup insertion appears anywhere near it.
 */
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
            <td key={column.id}>{column.renderCell(row)}</td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
