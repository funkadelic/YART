import { describe, expect, it } from "vitest";

import { DEFAULT_TABLE_STATE, type TableState } from "./tableState";
import {
  parseSearchTerm,
  parseTableState,
  serializeTableState,
} from "./tableStateUrl";

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

// A signed token that does not name a column of the supplied set, which is the
// only rule the sort parameter has: there is no separate direction to reject,
// because the direction cannot be stated without a column to attach it to.
const REJECTED_SORTS: ReadonlyArray<readonly [string, string]> = [
  ["a column that does not exist", "?sort=nope"],
  ["a prototype member's name", "?sort=__proto__"],
  ["a key with no value", "?sort="],
  ["a direction with no column", "?sort=-"],
  ["a shouted id, since membership compares exactly", "?sort=NAME"],
];

// Everything outside the offered list, because the table's own select cannot
// represent a size that is not one of its options.
const REJECTED_SIZES: ReadonlyArray<readonly [string, string]> = [
  ["a size the table does not offer", "?size=7"],
  ["a word", "?size=abc"],
  ["an enormous value in exponent notation", "?size=1e9"],
  ["a key with no value", "?size="],
];

describe("parseTableState", () => {
  it("reads a page position out of the query", () => {
    expect(parseTableState("?page=3", WIDGET_COLUMN_IDS)).toEqual({ page: 3 });
  });

  it("reads an empty query as no restored fields at all", () => {
    expect(parseTableState("", WIDGET_COLUMN_IDS)).toEqual({});
  });

  it("reads a search term out of the query", () => {
    expect(parseTableState("?q=tokyo", WIDGET_COLUMN_IDS)).toEqual({
      query: "tokyo",
    });
  });

  // The term is the one owned key with no rule to fail, so a stated empty term
  // is read rather than rejected. It happens to be the default, which is why
  // the view a reader sees is the same either way.
  it("reads a stated empty term as the empty term, which is also the default", () => {
    const restored = parseTableState("?q=", WIDGET_COLUMN_IDS);

    expect(restored).toEqual({ query: "" });
    expect({ ...DEFAULT_TABLE_STATE, ...restored }).toEqual(
      DEFAULT_TABLE_STATE,
    );
  });

  // Both spellings of a space are what the query serializer produces and
  // accepts, and getting either of them wrong is the reason nothing here is
  // hand rolled.
  it("reads either spelling of a space in a term as one space", () => {
    expect(parseTableState("?q=new%20york", WIDGET_COLUMN_IDS)).toEqual({
      query: "new york",
    });
    expect(parseTableState("?q=new+york", WIDGET_COLUMN_IDS)).toEqual({
      query: "new york",
    });
  });

  it("reads a term carrying the query string's own punctuation back intact", () => {
    expect(parseTableState("?q=a%26b%3Dc%23d", WIDGET_COLUMN_IDS)).toEqual({
      query: "a&b=c#d",
    });
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

  it("reads a bare column id as that column ascending", () => {
    expect(parseTableState("?sort=name", WIDGET_COLUMN_IDS)).toEqual({
      sortColumnId: "name",
      sortDirection: "asc",
    });
  });

  it("reads a signed column id as that column descending", () => {
    expect(parseTableState("?sort=-name", WIDGET_COLUMN_IDS)).toEqual({
      sortColumnId: "name",
      sortDirection: "desc",
    });
  });

  for (const [label, search] of REJECTED_SORTS) {
    it(`leaves the table unsorted for ${label}`, () => {
      expect(parseTableState(search, WIDGET_COLUMN_IDS)).toEqual({});
    });
  }

  it("reads an offered page size out of the query", () => {
    expect(parseTableState("?size=25", WIDGET_COLUMN_IDS)).toEqual({
      pageSize: 25,
    });
  });

  for (const [label, search] of REJECTED_SIZES) {
    it(`leaves the page size out for ${label}`, () => {
      expect(parseTableState(search, WIDGET_COLUMN_IDS)).toEqual({});
    });
  }

  it("reads the same state whichever order the parameters arrive in", () => {
    expect(
      parseTableState("?size=25&sort=-size&page=3", WIDGET_COLUMN_IDS),
    ).toEqual(parseTableState("?page=3&size=25&sort=-size", WIDGET_COLUMN_IDS));
  });

  it("takes the first occurrence of a repeated key", () => {
    expect(parseTableState("?page=2&page=5", WIDGET_COLUMN_IDS)).toEqual({
      page: 2,
    });
  });

  // The whole hostile query from the roadmap, which is the point of the total
  // parse: every parameter fails on its own terms and none of them takes any
  // other one down with it, so the reader gets the default view rather than a
  // broken one.
  it("falls back on every parameter of a hostile query at once, and builds a plain object doing it", () => {
    const restored = parseTableState(
      "?page=abc&size=1e9&sort=__proto__&dir=sideways",
      WIDGET_COLUMN_IDS,
    );

    expect(restored).toEqual({});
    expect(Object.getPrototypeOf(restored)).toBe(Object.prototype);
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

  it("writes an ascending sort as the bare column id", () => {
    expect(
      serializeTableState(
        stateWith({ sortColumnId: "name", sortDirection: "asc" }),
        "",
      ),
    ).toBe("?sort=name");
  });

  it("writes a descending sort as the signed column id", () => {
    expect(
      serializeTableState(
        stateWith({ sortColumnId: "name", sortDirection: "desc" }),
        "",
      ),
    ).toBe("?sort=-name");
  });

  it("writes an offered page size when it is not the default", () => {
    expect(serializeTableState(stateWith({ pageSize: 50 }), "")).toBe(
      "?size=50",
    );
  });

  it("writes nothing at all for an empty term, which is what an empty box means", () => {
    expect(serializeTableState(stateWith({ query: "" }), "")).toBe("");
  });

  it("writes a term carrying a space so that it reads back as one space", () => {
    const written = serializeTableState(stateWith({ query: "new york" }), "");

    expect(parseTableState(written, WIDGET_COLUMN_IDS)).toEqual({
      query: "new york",
    });
  });

  it("writes a term carrying the query string's own punctuation so that it reads back intact", () => {
    const written = serializeTableState(stateWith({ query: "a&b=c#d" }), "");

    expect(written).toBe("?q=a%26b%3Dc%23d");
    expect(parseTableState(written, WIDGET_COLUMN_IDS)).toEqual({
      query: "a&b=c#d",
    });
  });

  // Canonical order is the schema table's own order, which is what makes two
  // equivalent views produce one string. An order that followed the incoming
  // query would make the output a function of the input and there would be no
  // canonical form to compare against.
  it("writes the owned keys in the schema's order whatever order they arrived in", () => {
    expect(
      serializeTableState(
        stateWith({
          query: "tokyo",
          sortColumnId: "name",
          sortDirection: "desc",
          page: 3,
          pageSize: 25,
        }),
        "?size=100&page=9&sort=size&q=kyoto",
      ),
    ).toBe("?q=tokyo&sort=-name&page=3&size=25");
  });

  it("keeps the parameters it does not own after the ones it does, in the order they arrived", () => {
    expect(
      serializeTableState(
        stateWith({ page: 3 }),
        "?utm_source=x&dir=sideways&page=9",
      ),
    ).toBe("?page=3&utm_source=x&dir=sideways");
  });

  // Under one signed sort token there is no direction key to own, so the
  // roadmap's own `dir=sideways` is an unknown parameter rather than an invalid
  // one. Its survival is the preservation rule working, not a validation miss.
  it("preserves the unrecognized direction key from the hostile query", () => {
    expect(
      serializeTableState(
        stateWith({ page: 2 }),
        "?page=abc&size=1e9&sort=__proto__&dir=sideways",
      ),
    ).toBe("?page=2&dir=sideways");
  });

  it("keeps both occurrences of a repeated key it does not own", () => {
    expect(serializeTableState(DEFAULT_TABLE_STATE, "?a=1&a=2")).toBe(
      "?a=1&a=2",
    );
  });

  it("writes nothing for a sort left at the default", () => {
    expect(serializeTableState(stateWith({ page: 2 }), "?sort=name")).toBe(
      "?page=2",
    );
  });

  it("writes nothing for a page size left at the default", () => {
    expect(serializeTableState(stateWith({ page: 2 }), "?size=10")).toBe(
      "?page=2",
    );
  });
});

// The property that makes a link shareable at all: what the address says and
// what the table shows are the same thing, in both directions.
describe("the round trip", () => {
  const ROUND_TRIPPED: ReadonlyArray<
    readonly [string, Partial<TableState<WidgetColumnId>>]
  > = [
    ["a table at every default", {}],
    ["a page position alone", { page: 4 }],
    ["an ascending sort", { sortColumnId: "size", sortDirection: "asc" }],
    ["a descending sort", { sortColumnId: "name", sortDirection: "desc" }],
    ["a page size alone", { pageSize: 100 }],
    ["a search term alone", { query: "tokyo" }],
    ["a term carrying a space", { query: "new york" }],
    [
      "a term carrying the query string's own punctuation",
      { query: "a&b=c#d" },
    ],
    [
      "all four at once",
      {
        query: "tokyo",
        sortColumnId: "size",
        sortDirection: "desc",
        page: 6,
        pageSize: 25,
      },
    ],
  ];

  for (const [label, fields] of ROUND_TRIPPED) {
    it(`reproduces ${label}`, () => {
      const state = stateWith(fields);

      const restored = parseTableState(
        serializeTableState(state, ""),
        WIDGET_COLUMN_IDS,
      );

      expect({ ...DEFAULT_TABLE_STATE, ...restored }).toEqual(state);
    });
  }
});

describe("parseSearchTerm", () => {
  it("reads the term out of a fully specified query and ignores the rest", () => {
    expect(parseSearchTerm("?q=tokyo&sort=-population&page=3")).toBe("tokyo");
  });

  it("reads an empty query as the empty term", () => {
    expect(parseSearchTerm("")).toBe("");
  });

  it("reads a query with no term as the empty term", () => {
    expect(parseSearchTerm("?page=3")).toBe("");
  });

  // Same schema, so the term is decoded the same way whichever entry point
  // reads it. A second decoding rule living here is the drift this narrow
  // entry point exists to avoid.
  it("decodes a term exactly as the four-key reader does", () => {
    expect(parseSearchTerm("?q=a%26b%3Dc%23d")).toBe("a&b=c#d");
    expect(parseSearchTerm("?q=new+york")).toBe("new york");
  });
});
