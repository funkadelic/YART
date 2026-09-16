import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { collatorFor } from "../../i18n/format";
import { columns } from "./column";
import { sortRows } from "./sortRows";

// Fixed seed, so a failure names an input that can be run again and the gate
// cannot flake. Change it to search elsewhere.
const RUNS = { seed: 20260915, numRuns: 200 };

/**
 * A row type this module could plausibly be handed and the application never
 * will be, the same shape the example suite beside this one uses.
 */
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

// Both sortable fields come from a handful of values, so most generated sets
// carry ties and blanks for the identity tiebreak to decide.
const parts = fc.uniqueArray(
  fc.record({
    sku: fc.string({ minLength: 1 }),
    region: fc.constantFrom("", "north", "south", "east"),
    weight: fc.integer({ min: 0, max: 3 }),
  }),
  { selector: (part) => part.sku },
);

// The same set twice, in two arrival orders. A search returns its rows in a
// different order every time, so an ordering that read the arrival would
// reshuffle rows the reader never touched.
const arrivals = parts.chain((rows) =>
  fc.tuple(
    fc.constant(rows),
    fc.shuffledSubarray(rows, {
      minLength: rows.length,
      maxLength: rows.length,
    }),
  ),
);

describe("sortRows", () => {
  it("hands back the rows it was given and no others", () => {
    fc.assert(
      fc.property(parts, column, direction, (rows, sortBy, sortDirection) => {
        const sorted = sortRows(rows, sortBy, sortDirection, partId);

        expect(sorted).toHaveLength(rows.length);
        expect(sorted.map(partId).toSorted()).toEqual(
          rows.map(partId).toSorted(),
        );
      }),
      RUNS,
    );
  });

  it("orders a set the same way whichever order it arrives in", () => {
    fc.assert(
      fc.property(
        arrivals,
        column,
        direction,
        ([rows, shuffled], sortBy, sortDirection) => {
          expect(
            sortRows(shuffled, sortBy, sortDirection, partId).map(partId),
          ).toEqual(sortRows(rows, sortBy, sortDirection, partId).map(partId));
        },
      ),
      RUNS,
    );
  });

  it("leaves an order it already produced alone", () => {
    fc.assert(
      fc.property(parts, column, direction, (rows, sortBy, sortDirection) => {
        const sorted = sortRows(rows, sortBy, sortDirection, partId);

        expect(
          sortRows(sorted, sortBy, sortDirection, partId).map(partId),
        ).toEqual(sorted.map(partId));
      }),
      RUNS,
    );
  });
});
