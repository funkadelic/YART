import { describe, expect, it } from "vitest";

import {
  DEFAULT_TABLE_STATE,
  PAGE_SIZE_OPTIONS,
  applyTableAction,
  type TableAction,
  type TableState,
} from "./tableState";

type WidgetColumnId = "name" | "size";

const BASE: TableState<WidgetColumnId> = {
  ...DEFAULT_TABLE_STATE,
  page: 4,
};

const sorted = (
  columnId: WidgetColumnId | null,
  direction: "asc" | "desc" | null,
): TableState<WidgetColumnId> => ({
  ...BASE,
  sortColumnId: columnId,
  sortDirection: direction,
});

// The whole sort cycle, written out rather than driven by a loop over presses,
// so a reader can see which press produces which state without simulating the
// sequence in their head. Four rows is the entire cycle: a column that is not
// the active one, then the three states the active one moves through.
const SORT_CYCLE: Array<
  [
    string,
    TableState<WidgetColumnId>,
    WidgetColumnId | null,
    "asc" | "desc" | null,
  ]
> = [
  ["a column that is not the active one", sorted("size", "asc"), "name", "asc"],
  ["the active ascending column", sorted("name", "asc"), "name", "desc"],
  ["the active descending column", sorted("name", "desc"), null, null],
  ["a cleared column", sorted(null, null), "name", "asc"],
  // Unreachable through the reducer's own transitions: the press that clears a
  // sort nulls the column along with the direction, so nothing here produces a
  // named column with no direction. A restored URL will, which is what this row
  // covers ahead of the phase that adds one.
  ["the active column with no direction", sorted("name", null), "name", "asc"],
];

describe("applyTableAction: sorting", () => {
  for (const [label, state, columnId, direction] of SORT_CYCLE) {
    it(`sorting ${label} gives ${columnId ?? "no column"} ${direction ?? "unsorted"}`, () => {
      const next = applyTableAction(state, { type: "sort", columnId: "name" });

      expect(next.sortColumnId).toBe(columnId);
      expect(next.sortDirection).toBe(direction);
    });
  }

  it("marks the table as having been sorted, including on the press that clears the sort", () => {
    for (const [, state] of SORT_CYCLE) {
      expect(
        applyTableAction(state, { type: "sort", columnId: "name" }).hasSorted,
      ).toBe(true);
    }
  });
});

describe("applyTableAction: the page", () => {
  const RESETS: Array<[string, TableAction<WidgetColumnId>]> = [
    ["sorting", { type: "sort", columnId: "name" }],
    ["changing the page size", { type: "pageSize", pageSize: 25 }],
    ["searching", { type: "query", query: "oslo" }],
  ];

  for (const [label, action] of RESETS) {
    it(`returns to the first page when ${label}`, () => {
      expect(applyTableAction(BASE, action).page).toBe(1);
    });
  }

  it("sets the page to exactly the number it was given", () => {
    expect(applyTableAction(BASE, { type: "page", page: 7 }).page).toBe(7);
  });

  it("does not clamp a page far past any available one", () => {
    // Clamping is the pagination module's job and it is a read, not a write.
    // A position stored here that has been corrected against a narrowed result
    // set cannot be restored when the set widens again, and a position that
    // arrives before the rows do would be corrected against no rows at all.
    expect(applyTableAction(BASE, { type: "page", page: 9999 }).page).toBe(
      9999,
    );
  });

  it("does not clamp a page below one", () => {
    expect(applyTableAction(BASE, { type: "page", page: 0 }).page).toBe(0);
  });

  it("keeps the page it holds when nothing about the row set changed", () => {
    expect(applyTableAction(BASE, { type: "page", page: 4 }).page).toBe(4);
  });

  // The debounce commits any sequence of keystrokes that pauses, including one
  // that undoes itself, so a reader who types a character and deletes it
  // commits the term they already had. The rows are the same rows and the
  // position chosen against them still means what it meant.
  it("keeps the page when a term settles back where it started", () => {
    const searched: TableState<WidgetColumnId> = { ...BASE, query: "oslo" };

    const next = applyTableAction(searched, { type: "query", query: "oslo" });

    expect(next.page).toBe(4);
    // The same object, not merely an equal one, so the render and the address
    // write behind it never run for a change that did not happen.
    expect(next).toBe(searched);
  });

  // The counterpart, and the reason the guard above names the query action
  // rather than comparing whatever field an action happens to carry. Neither
  // other control can emit its own current value, so a guard covering them
  // would be a rule with no case it applies to, and the reset would stop being
  // one line a reader can find.
  it("still returns to the first page for a size that is already in effect", () => {
    const next = applyTableAction(BASE, {
      type: "pageSize",
      pageSize: BASE.pageSize,
    });

    expect(next.page).toBe(1);
  });

  it("returns to the first page when an empty term follows a non-empty one", () => {
    const searched: TableState<WidgetColumnId> = { ...BASE, query: "oslo" };

    expect(applyTableAction(searched, { type: "query", query: "" }).page).toBe(
      1,
    );
  });
});

describe("applyTableAction: the query and the page size", () => {
  it("stores the search term verbatim", () => {
    const next = applyTableAction(BASE, { type: "query", query: "  São " });

    expect(next.query).toBe("  São ");
  });

  it("stores the page size it was given", () => {
    expect(
      applyTableAction(BASE, { type: "pageSize", pageSize: 100 }).pageSize,
    ).toBe(100);
  });
});

describe("applyTableAction: purity", () => {
  const EVERY_ACTION: Array<TableAction<WidgetColumnId>> = [
    { type: "sort", columnId: "name" },
    { type: "page", page: 2 },
    { type: "pageSize", pageSize: 50 },
    { type: "query", query: "lima" },
  ];

  for (const action of EVERY_ACTION) {
    it(`returns a new object and leaves the old one alone on a ${action.type} action`, () => {
      const before = { ...BASE };

      const next = applyTableAction(BASE, action);

      expect(next).not.toBe(BASE);
      expect(BASE).toEqual(before);
    });
  }
});

describe("DEFAULT_TABLE_STATE", () => {
  it("starts on the first page, ten rows at a time, unsorted, unsearched, and silent", () => {
    expect(DEFAULT_TABLE_STATE).toEqual({
      sortColumnId: null,
      sortDirection: null,
      page: 1,
      pageSize: 10,
      query: "",
      hasSorted: false,
    });
  });

  // The one thing that has to hold for the rule that keeps defaults out of the
  // address and the select's own rendered value to agree, and the first thing
  // that breaks if the default or the offered list is edited alone.
  it("starts at a size the table actually offers", () => {
    expect(PAGE_SIZE_OPTIONS).toContain(DEFAULT_TABLE_STATE.pageSize);
  });
});
