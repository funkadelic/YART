import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TABLE_STATE,
  PAGE_SIZE_OPTIONS,
  type TableState,
} from "./tableState";
import { parseTableState, serializeTableState } from "./tableStateUrl";

// Fixed seed, so a failure names an input that can be run again and the gate
// cannot flake. Change it to search elsewhere.
const RUNS = { seed: 20260915, numRuns: 200 };

// A made-up pair of ids, because the module takes the valid ids as an argument
// precisely so it never learns what a row is.
type WidgetColumnId = "name" | "size";

const WIDGET_COLUMN_IDS: readonly WidgetColumnId[] = ["name", "size"];

/** The four query keys the module owns, and the state fields it restores. */
const OWNED_KEYS = ["q", "sort", "page", "size"];
const OWNED_FIELDS = [
  "query",
  "sortColumnId",
  "sortDirection",
  "page",
  "pageSize",
];

// One key carries both halves of the sort, so a column without a direction is
// not a state the address can hold.
const sort = fc.oneof(
  fc.constant({ sortColumnId: null, sortDirection: null }),
  fc.record({
    sortColumnId: fc.constantFrom(...WIDGET_COLUMN_IDS),
    sortDirection: fc.constantFrom("asc" as const, "desc" as const),
  }),
);

// hasSorted stays at the default, because it is view state the address
// deliberately does not carry.
const state: fc.Arbitrary<TableState<WidgetColumnId>> = fc
  .record({
    sort,
    page: fc.integer({ min: 1, max: 1_000_000 }),
    pageSize: fc.constantFrom(...PAGE_SIZE_OPTIONS),
    query: fc.string(),
  })
  .map(({ sort: sorted, page, pageSize, query }) => ({
    ...DEFAULT_TABLE_STATE,
    ...sorted,
    page,
    pageSize,
    query,
  }));

// Both shapes an address arrives in: a well-formed query naming the owned keys
// with whatever values, and a raw string that was never a query at all.
const address = fc.oneof(
  fc.string(),
  fc
    .array(
      fc.tuple(
        fc.constantFrom("q", "sort", "page", "size", "dir", "utm_source"),
        fc.string(),
      ),
    )
    .map((pairs) => `?${new URLSearchParams(pairs).toString()}`),
);

const unownedPairs = fc.array(
  fc.tuple(
    fc.string().filter((key) => !OWNED_KEYS.includes(key)),
    fc.string(),
  ),
);

describe("the round trip", () => {
  it("reproduces a state, up to the trim the address applies to the term", () => {
    fc.assert(
      fc.property(state, (value) => {
        const restored = parseTableState(
          serializeTableState(value, ""),
          WIDGET_COLUMN_IDS,
        );

        expect({ ...DEFAULT_TABLE_STATE, ...restored }).toEqual({
          ...value,
          query: value.query.trim(),
        });
      }),
      RUNS,
    );
  });
});

describe("parseTableState", () => {
  it("reads any address as owned fields carrying values it accepts", () => {
    fc.assert(
      fc.property(address, (search) => {
        const restored = parseTableState(search, WIDGET_COLUMN_IDS);

        expect(Object.getPrototypeOf(restored)).toBe(Object.prototype);
        for (const field of Object.keys(restored)) {
          expect(OWNED_FIELDS).toContain(field);
        }

        if (restored.page !== undefined) {
          expect(Number.isInteger(restored.page)).toBe(true);
          expect(restored.page).toBeGreaterThan(0);
        }
        if (restored.pageSize !== undefined) {
          expect(PAGE_SIZE_OPTIONS).toContain(restored.pageSize);
        }
        if (restored.sortColumnId != null) {
          expect(WIDGET_COLUMN_IDS).toContain(restored.sortColumnId);
          expect(["asc", "desc"]).toContain(restored.sortDirection);
        }
      }),
      RUNS,
    );
  });
});

describe("serializeTableState", () => {
  it("carries every parameter it does not own through a write, in order", () => {
    fc.assert(
      fc.property(state, unownedPairs, (value, pairs) => {
        const written = serializeTableState(
          value,
          `?${new URLSearchParams(pairs).toString()}`,
        );

        const kept = [...new URLSearchParams(written)].filter(
          ([key]) => !OWNED_KEYS.includes(key),
        );

        expect(kept).toEqual(pairs);
      }),
      RUNS,
    );
  });
});
