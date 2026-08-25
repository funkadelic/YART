/**
 * Everything the table remembers between renders, in one object.
 *
 * It is one object rather than five values because it is also what gets read
 * whole: a serialiser writes all of it at once and a restored address writes
 * all of it back at once, and five separate writes are five chances to tear.
 */
export interface TableState<Id extends string> {
  readonly sortColumnId: Id | null;
  readonly sortDirection: "asc" | "desc" | null;
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  /**
   * A cleared sort and a sort that has never been applied render the same
   * state, so the announcement needs to know which of the two it is looking at:
   * the first render has to stay silent, the third press on a column does not.
   */
  readonly hasSorted: boolean;
}

export type TableAction<Id extends string> =
  | { readonly type: "sort"; readonly columnId: Id }
  | { readonly type: "page"; readonly page: number }
  | { readonly type: "pageSize"; readonly pageSize: number }
  | { readonly type: "query"; readonly query: string };

/**
 * Where a table starts, with three readers: the state below it, whatever
 * serialises the state (a value equal to one of these is the value to leave
 * out), and whatever parses it back (a parameter that fails validation falls
 * back to the value here). One owner is what keeps those three agreeing.
 *
 * Typed over no column id at all, which makes it assignable to a table state
 * over any id union, since the only place an id appears is a field that may
 * also be null.
 */
export const DEFAULT_TABLE_STATE: TableState<never> = {
  sortColumnId: null,
  sortDirection: null,
  page: 1,
  pageSize: 10,
  query: "",
  hasSorted: false,
};

/**
 * The page sizes the table offers, in the order it offers them.
 *
 * One owner because this list is two things at once: the surface a reader picks
 * from, and the rule that decides whether a size arriving from outside the
 * application is one the table can represent. Two independent copies of a list
 * with no mechanism keeping them in step is a failure mode this project has
 * already filed once, and it costs one line here to avoid.
 *
 * Not narrowed with a const assertion: the membership test reads an arbitrary
 * number, so a union of the four literals would be a type the caller cannot
 * hand a value to.
 */
export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100];

/**
 * The fields an action changes, before the page reset is applied over them.
 * Split out so the reset below can be written once for all three actions that
 * trigger it rather than repeated inside each of their branches.
 */
function changedBy<Id extends string>(
  state: TableState<Id>,
  action: Exclude<TableAction<Id>, { type: "page" }>,
): Partial<TableState<Id>> {
  switch (action.type) {
    case "pageSize":
      return { pageSize: action.pageSize };
    case "query":
      return { query: action.query };
    case "sort": {
      const { columnId } = action;
      // Sorting cycles rather than toggling: a new column starts ascending, the
      // active one goes ascending to descending to unsorted, and a cleared
      // column starts over. Every branch reports that a sort happened,
      // including the one that clears it.
      if (state.sortColumnId !== columnId) {
        return {
          sortColumnId: columnId,
          sortDirection: "asc",
          hasSorted: true,
        };
      }
      if (state.sortDirection === "asc") {
        return { sortDirection: "desc", hasSorted: true };
      }
      if (state.sortDirection === "desc") {
        return { sortColumnId: null, sortDirection: null, hasSorted: true };
      }
      return { sortColumnId: columnId, sortDirection: "asc", hasSorted: true };
    }
  }
}

/**
 * The only thing that moves the table from one state to the next.
 *
 * It is pure and knows nothing about React, so the rules below can be read and
 * tested without rendering anything.
 */
export function applyTableAction<Id extends string>(
  state: TableState<Id>,
  action: TableAction<Id>,
): TableState<Id> {
  if (action.type === "page") {
    // Taken exactly as given, never corrected against the pages that happen to
    // exist. Correcting here would store a position the user did not choose, so
    // a result set that widens again could not restore them, and a position
    // arriving before its rows do would be corrected against no rows at all.
    // The correction belongs where the rows are counted, and it belongs to the
    // read rather than to the write.
    return { ...state, page: action.page };
  }

  // A term that settles back where it started leaves the same rows in the same
  // order, so the position chosen against them still means what it meant. This
  // is the one action a control can emit at its current value: a sort press and
  // a size selection are always a real change, while the debounce commits any
  // sequence of keystrokes that pauses, including one that undoes itself. The
  // same state object rather than an equal one, so the render and the address
  // write behind it never run for a change that did not happen.
  if (action.type === "query" && action.query === state.query) {
    return state;
  }

  // Sorting, resizing the page, and searching each replace the set of rows the
  // position was chosen against, so all three return to the first page. Fused
  // into one return so that reset has exactly one site in the codebase: whoever
  // adds a fifth action has to decide about it rather than forget it. The guard
  // above is a guard against the action, not a condition on the reset: once an
  // action reaches this line it resets, whatever it carries.
  return { ...state, ...changedBy(state, action), page: 1 };
}
