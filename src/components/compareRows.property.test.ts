import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { collatorFor } from "../i18n/format";
import { compareValues } from "./compareRows";

// Fixed seed, so a failure names an input that can be run again and the gate
// cannot flake. Change it to search elsewhere.
const RUNS = { seed: 20260915, numRuns: 200 };

/** The comparator holds no collator, so every caller names a tag. */
const EN = collatorFor("en-US");

const direction = fc.constantFrom("asc" as const, "desc" as const);

// Anything a widened cell can hold: the two present ranks, the non-primitive
// third, and every spelling of a blank. The double arbitrary supplies NaN and
// the infinities on its own.
const value = fc.oneof(
  fc.double(),
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant({ toString: () => "object" }),
);

const blank = fc.constantFrom("", null, undefined, NaN);

const present = fc.oneof(
  fc.double({ noNaN: true }),
  fc.string({ minLength: 1 }),
);

describe("compareValues", () => {
  // Summed rather than compared against a negation, because negating zero gives
  // -0, which toBe reads as unequal.
  it("answers a swapped pair with the opposite sign", () => {
    fc.assert(
      fc.property(value, value, direction, (left, right, sortDirection) => {
        const forward = compareValues(left, right, sortDirection, EN);
        const backward = compareValues(right, left, sortDirection, EN);

        expect(Math.sign(forward) + Math.sign(backward)).toBe(0);
      }),
      RUNS,
    );
  });

  it("reports a value equal to itself in both directions", () => {
    fc.assert(
      fc.property(value, direction, (only, sortDirection) => {
        expect(compareValues(only, only, sortDirection, EN)).toBe(0);
      }),
      RUNS,
    );
  });

  it("orders a number ahead of a string and both ahead of anything else", () => {
    const other = { toString: () => "object" };

    fc.assert(
      fc.property(
        fc.double({ noNaN: true }),
        fc.string({ minLength: 1 }),
        (number, text) => {
          expect(compareValues(number, text, "asc", EN)).toBeLessThan(0);
          expect(compareValues(text, other, "asc", EN)).toBeLessThan(0);
          expect(compareValues(number, other, "asc", EN)).toBeLessThan(0);
        },
      ),
      RUNS,
    );
  });

  it("orders a blank last whichever direction is asked for", () => {
    fc.assert(
      fc.property(blank, present, direction, (empty, filled, sortDirection) => {
        expect(compareValues(empty, filled, sortDirection, EN)).toBeGreaterThan(
          0,
        );
        expect(compareValues(filled, empty, sortDirection, EN)).toBeLessThan(0);
      }),
      RUNS,
    );
  });
});
