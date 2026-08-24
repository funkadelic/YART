import type { ReactNode } from "react";

import { compareValues } from "../compareRows";

/**
 * A column, with its value type already fused in and then erased.
 *
 * The value type is deliberately absent from this interface. Keeping it as a
 * second type parameter is the shape every table library reaches for, and it
 * does not compile here: under strictFunctionTypes with property syntax, a
 * column over a string value is not assignable to a column over an unknown one,
 * so a heterogeneous array collapses the moment it is annotated or crosses a
 * prop boundary. The method-syntax workaround compiles only because methods are
 * bivariant, which is unsound, and it hands the cell renderer a value it cannot
 * narrow. Fusing the value type into the two functions at construction and
 * dropping it from the element type costs the table the ability to inspect a
 * value, which the table never needed, and buys an array of columns over
 * different value types that survives being passed around.
 */
export interface Column<T, Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  /**
   * Declared now and set by nothing. Row virtualization needs a width it can
   * measure without reading the DOM, and amending this interface twice is the
   * cost that buys.
   */
  readonly width?: string;
  readonly renderCell: (row: T) => ReactNode;
  readonly compare: (a: T, b: T, direction: "asc" | "desc") => number;
}

/**
 * What a caller supplies. Everything here is value-level: the accessor has
 * already been applied by the time a renderer or a comparator declared here is
 * called, which is what lets the value type be inferred once, at the call site,
 * with no annotation.
 *
 * The comparator takes the direction rather than being flipped by its caller.
 * Blanks sort last in both directions, which is a rule a direction-free
 * comparator cannot express: negating it puts every blank first on descending,
 * and on real data that is a first page of empty cells.
 */
export interface ColumnOptions<T, V> {
  readonly label: string;
  readonly width?: string;
  readonly renderCell?: (value: V, row: T) => ReactNode;
  readonly compare?: (a: V, b: V, direction: "asc" | "desc") => number;
}

/**
 * Builds columns for one row type.
 *
 * Curried because TypeScript infers all of a call's type arguments or none of
 * them. The row type is the one thing a caller knows and the compiler cannot
 * guess, so it is supplied here; the column id and the value type are then
 * inferred per call, which is the whole point.
 *
 * The id is a const type parameter, so an array of these carries the literal
 * union of its ids with no assertion written anywhere. Renaming a column is
 * then a compile error at every use site rather than a silent widening to
 * string.
 */
export function columns<T>() {
  /**
   * The one place where the accessor is fused into the renderer and the
   * comparator, so the two public methods below differ only in how they read a
   * value. Supplying neither leaves the value stringified for display and
   * ordered by the shared comparator.
   */
  function build<Id extends string, V>(
    id: Id,
    read: (row: T) => V,
    options: ColumnOptions<T, V>,
  ): Column<T, Id> {
    const { renderCell, compare } = options;

    return {
      id,
      label: options.label,
      width: options.width,
      renderCell: renderCell
        ? (row) => renderCell(read(row), row)
        : (row) => String(read(row)),
      compare: compare
        ? (a, b, direction) => compare(read(a), read(b), direction)
        : (a, b, direction) => compareValues(read(a), read(b), direction),
    };
  }

  return {
    /**
     * A column whose id is one of the row type's own string keys, and whose
     * value is that field. Constrained to the string keys because a number or
     * symbol key cannot be a column id.
     */
    key<const Id extends Extract<keyof T, string>>(
      id: Id,
      options: ColumnOptions<T, T[Id]>,
    ) {
      return build<Id, T[Id]>(id, (row) => row[id], options);
    },

    /**
     * A column whose value is computed rather than read, so its id is free of
     * the row type and its value type is inferred from the read function.
     */
    accessor<const Id extends string, V>(
      id: Id,
      read: (row: T) => V,
      options: ColumnOptions<T, V>,
    ) {
      return build<Id, V>(id, read, options);
    },
  };
}
