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
  /**
   * Unique within the array the column is rendered in. A repeat collides on
   * the cell key React reconciles a row by and on the lookup that resolves the
   * sort column. The builder below covers the array one builder produces, which
   * is every array in this tree; concatenating two builders' output is not
   * checked anywhere.
   */
  readonly id: Id;
  readonly label: string;
  /**
   * Declared now and set by nothing. Row virtualization needs a width it can
   * measure without reading the DOM, and amending this interface twice is the
   * cost that buys.
   */
  readonly width?: string | undefined;
  /**
   * The column carries a number. The table decides what that looks like.
   */
  readonly numeric?: boolean | undefined;
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
 *
 * ponytail: a caller-supplied comparator keeps the three parameters it has
 * always had and never receives the collator, so a caller that wants to collate
 * text itself has to reach for one of its own. Nothing in this tree does. The
 * day one does, the collator arrives the same way the accessor does: fused in
 * at construction, one line below.
 */
export interface ColumnOptions<T, V> {
  readonly label: string;
  readonly width?: string | undefined;
  readonly numeric?: boolean | undefined;
  readonly renderCell?: ((value: V, row: T) => ReactNode) | undefined;
  readonly compare?:
    ((a: V, b: V, direction: "asc" | "desc") => number) | undefined;
}

/**
 * Builds columns for one row type.
 *
 * Curried because TypeScript infers all of a call's type arguments or none of
 * them. The row type is the one thing a caller knows and the compiler cannot
 * guess, so it is supplied here; the column id and the value type are then
 * inferred per call, which is the whole point.
 *
 * The id is constrained to string and every call site passes a string literal,
 * so it infers as that literal, not as string. An array of these carries the
 * literal union of its ids with no assertion written anywhere, and renaming a
 * column is a compile error at every use site rather than a silent widening.
 *
 * The const modifier on the two id parameters below is redundant, since a
 * scalar string parameter already infers a literal from a literal argument.
 * It changes inference only for a parameter that takes an array or object,
 * which is not this signature.
 *
 * The collator is supplied here rather than reaching the comparison some other
 * way, and it is what makes the column array the carrier of the reader's
 * locale. The array is rebuilt per locale anyway, for its labels and for the
 * cells that format a number, so fusing the collator in at construction costs
 * one parameter and leaves the sort module, its hook and the table's own prop
 * surface entirely untouched. A collator is a platform value, so taking one
 * here leaves this layer's dependency set exactly as it was.
 *
 * One builder builds one table's columns, and throws on an id it has already
 * issued. A second, unrelated table takes a second builder.
 */
export function columns<T>(collator: Intl.Collator) {
  const issued = new Set<string>();

  /**
   * The one place where the accessor is fused into the renderer and the
   * comparator, so the two public methods below differ only in how they read a
   * value. Supplying neither leaves the value stringified for display, blank
   * if it is nullish, and ordered by the shared comparator.
   */
  function build<Id extends string, V>(
    id: Id,
    read: (row: T) => V,
    options: ColumnOptions<T, V>,
  ): Column<T, Id> {
    if (issued.has(id)) {
      throw new Error(`Duplicate column id: ${id}`);
    }
    issued.add(id);

    const { renderCell, compare } = options;

    return {
      id,
      label: options.label,
      width: options.width,
      numeric: options.numeric,
      renderCell: renderCell
        ? (row) => renderCell(read(row), row)
        : (row) => {
            // Nullish paints an empty cell rather than the word "null". NaN
            // is not covered: the comparator calls it blank, but a cell reading
            // "NaN" is worth seeing.
            const value = read(row);
            return value == null ? "" : String(value);
          },
      compare: compare
        ? (a, b, direction) => compare(read(a), read(b), direction)
        : (a, b, direction) =>
            compareValues(read(a), read(b), direction, collator),
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
