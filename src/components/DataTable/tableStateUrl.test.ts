import { describe, expect, it } from "vitest";

import { DEFAULT_TABLE_STATE, type TableState } from "./tableState";
import { parseTableState, serializeTableState } from "./tableStateUrl";

// A made-up pair of ids rather than the city columns: the module takes the
// valid ids as an argument precisely so it never learns what a row is, and
// borrowing a real column id here would quietly suggest otherwise.
type WidgetColumnId = "name" | "size";

const WIDGET_COLUMN_IDS: readonly WidgetColumnId[] = ["name", "size"];

const stateWith = (
  fields: Partial<TableState<WidgetColumnId>>,
): TableState<WidgetColumnId> => ({ ...DEFAULT_TABLE_STATE, ...fields });

// Every value here has to be rejected without a corrected one taking its place,
// because an omitted field is what makes the caller's spread over the defaults
// the only fallback anywhere in the round trip.
const REJECTED_PAGES: ReadonlyArray<readonly [string, string]> = [
  ["a word", "?page=abc"],
  ["zero", "?page=0"],
  ["a position below the first page", "?page=-1"],
  ["a fraction", "?page=1.5"],
  ["a key with no value", "?page="],
  ["an infinity", "?page=Infinity"],
  ["a number carrying trailing text", "?page=5abc"],
];

describe("parseTableState", () => {
  it("reads a page position out of the query", () => {
    expect(parseTableState("?page=3", WIDGET_COLUMN_IDS)).toEqual({ page: 3 });
  });

  it("reads an empty query as no restored fields at all", () => {
    expect(parseTableState("", WIDGET_COLUMN_IDS)).toEqual({});
  });

  for (const [label, search] of REJECTED_PAGES) {
    it(`leaves the page out for ${label}`, () => {
      expect(parseTableState(search, WIDGET_COLUMN_IDS)).toEqual({});
    });
  }

  it("accepts a position far past any page that could exist", () => {
    expect(parseTableState("?page=1e9", WIDGET_COLUMN_IDS)).toEqual({
      page: 1000000000,
    });
  });

  it("compares keys case sensitively, so a shouted key is an unknown one", () => {
    expect(parseTableState("?PAGE=3", WIDGET_COLUMN_IDS)).toEqual({});
  });

  it("builds a plain object even when a parameter is named after a prototype member", () => {
    const restored = parseTableState("?__proto__=x&page=2", WIDGET_COLUMN_IDS);

    expect(Object.getPrototypeOf(restored)).toBe(Object.prototype);
    expect(restored).toEqual({ page: 2 });
  });
});

describe("serializeTableState", () => {
  it("writes nothing at all for a table sitting at every default", () => {
    expect(serializeTableState(DEFAULT_TABLE_STATE, "")).toBe("");
  });

  it("writes the page position when it is not the default", () => {
    expect(serializeTableState(stateWith({ page: 4 }), "")).toBe("?page=4");
  });

  it("drops a default the incoming query stated out loud", () => {
    expect(serializeTableState(stateWith({ page: 1 }), "?page=9")).toBe("");
  });

  it("keeps a parameter it does not own, after the ones it does", () => {
    expect(serializeTableState(stateWith({ page: 2 }), "?utm_source=x")).toBe(
      "?page=2&utm_source=x",
    );
  });

  it("writes the same string twice for the same state", () => {
    const state = stateWith({ page: 7 });

    expect(serializeTableState(state, "?utm_source=x")).toBe(
      serializeTableState(state, "?utm_source=x"),
    );
  });
});
