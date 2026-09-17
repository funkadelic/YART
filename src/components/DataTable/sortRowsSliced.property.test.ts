import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { collatorFor } from "../../i18n/format";
import { columns } from "./column";
import { sortRows } from "./sortRows";
import { sortRowsSliced } from "./sortRowsSliced";

// Fixed seed, so a failure names an input that can be run again and the gate
// cannot flake. Change it to search elsewhere.
const RUNS = { seed: 20260916, numRuns: 200 };

/** The same row shape the sortRows property suite uses. */
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

// A handful of values per field, so most sets carry ties and blanks.
const parts = fc.uniqueArray(
  fc.record({
    sku: fc.string({ minLength: 1 }),
    region: fc.constantFrom("", "north", "south", "east"),
    weight: fc.integer({ min: 0, max: 3 }),
  }),
  { selector: (part) => part.sku },
);

// Short runs, so small sets still reach several merge passes.
const runLength = fc.integer({ min: 1, max: 4 });

describe("sortRowsSliced", () => {
  it("produces the order sortRows does", async () => {
    await fc.assert(
      fc.asyncProperty(
        parts,
        column,
        direction,
        runLength,
        async (rows, sortBy, sortDirection, run) => {
          const sliced = await sortRowsSliced(
            rows,
            sortBy,
            sortDirection,
            partId,
            () => false,
            run,
          );

          expect(sliced?.map(partId)).toEqual(
            sortRows(rows, sortBy, sortDirection, partId).map(partId),
          );
        },
      ),
      RUNS,
    );
  });
});
