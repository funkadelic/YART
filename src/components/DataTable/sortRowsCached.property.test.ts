import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { collatorFor } from "../../i18n/format";
import { columns } from "./column";
import { sortRows } from "./sortRows";
import { sortRowsCached } from "./sortRowsCached";

// Fixed seed, so a failure names an input that can be run again and the gate
// cannot flake. Change it to search elsewhere.
const RUNS = { seed: 20260915, numRuns: 200 };

/** The same generic row shape the example suite beside this one uses. */
interface Part {
  sku: string;
  region: string;
  weight: number;
}

const EN = collatorFor("en-US");

// A builder per column, because a builder rejects an id it has already issued.
const REGION = columns<Part>(EN).key("region", { label: "Region" });
const WEIGHT = columns<Part>(EN).key("weight", { label: "Weight" });

const column = fc.constantFrom(REGION, WEIGHT);

const direction = fc.constantFrom("asc" as const, "desc" as const);

const partId = (part: Part) => part.sku;

// Few values per field, so most generated sets carry ties and blanks.
const parts = fc.uniqueArray(
  fc.record({
    sku: fc.string({ minLength: 1 }),
    region: fc.constantFrom("", "north", "south", "east"),
    weight: fc.integer({ min: 0, max: 3 }),
  }),
  { selector: (part) => part.sku },
);

// A set paired with any shuffled subarray of it, as a search result would be.
const withSubset = parts.chain((rows) =>
  fc.tuple(fc.constant(rows), fc.shuffledSubarray(rows)),
);

describe("sortRowsCached", () => {
  it("orders a subset from the cache the way a fresh sort does", () => {
    fc.assert(
      fc.property(
        withSubset,
        column,
        direction,
        ([rows, subset], sortBy, sortDirection) => {
          sortRowsCached(rows, sortBy, "asc", partId);
          sortRowsCached(rows, sortBy, "desc", partId);

          expect(
            sortRowsCached(subset, sortBy, sortDirection, partId).map(partId),
          ).toEqual(
            sortRows(subset, sortBy, sortDirection, partId).map(partId),
          );
        },
      ),
      RUNS,
    );
  });
});
