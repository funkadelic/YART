import type { ReactNode } from "react";

import { compareValues } from "../compareRows";

/** Its value type is fused into the two functions below, then erased. */
export interface Column<T, Id extends string = string> {
  /** Unique within its array: a repeat collides on React's own cell key. */
  readonly id: Id;
  readonly label: string;
  /** Declared for a future row virtualizer and set by nothing today. */
  readonly width?: string | undefined;
  /** The column carries a number. The table decides what that looks like. */
  readonly numeric?: boolean | undefined;
  readonly renderCell: (row: T) => ReactNode;
  readonly compare: (a: T, b: T, direction: "asc" | "desc") => number;
}

/**
 * What a caller supplies. The comparator takes the direction rather than being
 * flipped by its caller, because blanks sort last in both.
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
 * Builds columns for one row type. Curried because TypeScript infers all of a
 * call's type arguments or none, so an array carries its literal id union with
 * no assertion. One builder per table: it throws on a repeated id.
 */
export function columns<T>(collator: Intl.Collator) {
  const issued = new Set<string>();

  /** The one place the accessor is fused into the renderer and comparator. */
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
            // Nullish paints an empty cell rather than the word "null". NaN is
            // not covered: the comparator calls it blank, but it is worth seeing.
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
    /** A column over one of the row type's own string keys. */
    key<const Id extends Extract<keyof T, string>>(
      id: Id,
      options: ColumnOptions<T, T[Id]>,
    ) {
      return build<Id, T[Id]>(id, (row) => row[id], options);
    },

    /** A computed column: its id is free of the row type, its value inferred. */
    accessor<const Id extends string, V>(
      id: Id,
      read: (row: T) => V,
      options: ColumnOptions<T, V>,
    ) {
      return build<Id, V>(id, read, options);
    },
  };
}
