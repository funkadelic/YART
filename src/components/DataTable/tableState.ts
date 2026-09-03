/** Everything the table remembers. Five separate writes would be five tears. */
export interface TableState<Id extends string> {
  readonly sortColumnId: Id | null;
  readonly sortDirection: "asc" | "desc" | null;
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  /** A cleared sort and a sort never applied otherwise look the same. */
  readonly hasSorted: boolean;
}

export type TableAction<Id extends string> =
  | { readonly type: "sort"; readonly columnId: Id }
  | { readonly type: "page"; readonly page: number }
  | { readonly type: "pageSize"; readonly pageSize: number }
  | { readonly type: "query"; readonly query: string };

/** Where a table starts. Typed over no id, so it fits any id union. */
export const DEFAULT_TABLE_STATE: TableState<never> = {
  sortColumnId: null,
  sortDirection: null,
  page: 1,
  pageSize: 10,
  query: "",
  hasSorted: false,
};

/** The page sizes offered, and the rule validating a size from outside. */
export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100];

/** The fields an action changes, before the shared page reset lands on top. */
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
      // Sorting cycles rather than toggling: ascending, descending, unsorted,
      // then over. Every branch reports a sort, the one that clears included.
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

/** The only thing that moves the table from one state to the next. */
export function applyTableAction<Id extends string>(
  state: TableState<Id>,
  action: TableAction<Id>,
): TableState<Id> {
  if (action.type === "page") {
    // Taken exactly as given. Correcting here would store a position the reader
    // did not choose, and a position arriving before its rows would be
    // corrected against no rows at all. The clamp belongs to the read.
    return { ...state, page: action.page };
  }

  // The one action a control can emit at its current value, because the
  // debounce commits any pause, including a sequence that undoes itself. The
  // same object rather than an equal one, so no render and no address write.
  if (action.type === "query" && action.query === state.query) {
    return state;
  }

  // Sorting, resizing and searching each replace the rows the position was
  // chosen against, so all three return to the first page. One site, so whoever
  // adds a fifth action has to decide about the reset rather than forget it.
  return { ...state, ...changedBy(state, action), page: 1 };
}
