import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { paginate } from "./paginate";

// Fixed seed, so a failure names an input that can be run again and the gate
// cannot flake. Change it to search elsewhere.
const RUNS = { seed: 20260915, numRuns: 200 };

// Plain rows, because the module is generic and nothing about paging reads a
// field.
const rows = fc.array(fc.integer());

const pageSize = fc.integer({ min: 1, max: 50 });

// Every position a caller can hold, including the ones the clamp exists for:
// below the first page, past the last, and the fraction a restored address can
// carry.
const requestedPage = fc.double({ noNaN: true });

describe("paginate", () => {
  it("never hands back more rows than the page size", () => {
    fc.assert(
      fc.property(rows, requestedPage, pageSize, (data, page, size) => {
        expect(
          paginate(data, page, size).paginatedData.length,
        ).toBeLessThanOrEqual(size);
      }),
      RUNS,
    );
  });

  it("reproduces the collection when every page is read in order", () => {
    fc.assert(
      fc.property(rows, pageSize, (data, size) => {
        const { totalPages } = paginate(data, 1, size);
        const pages = Array.from(
          { length: totalPages },
          (_, index) => paginate(data, index + 1, size).paginatedData,
        );

        expect(pages.flat()).toEqual(data);
      }),
      RUNS,
    );
  });

  // Bounded on purpose. A double drawn from the whole line lands between the
  // first and last page too rarely to reach the clamp with a fraction still on
  // it, so the collection is long enough for several pages and the position is
  // drawn from inside them. A fraction here would reach aria-rowindex as an
  // invalid row position.
  it("reads a fractional position as a whole page", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 10, maxLength: 60 }),
        fc.double({ min: 1, max: 10, noNaN: true }),
        fc.integer({ min: 1, max: 5 }),
        (data, page, size) => {
          expect(
            Number.isInteger(paginate(data, page, size).effectivePage),
          ).toBe(true);
        },
      ),
      RUNS,
    );
  });

  it("reads any requested position as a page that exists", () => {
    fc.assert(
      fc.property(rows, requestedPage, pageSize, (data, page, size) => {
        const { effectivePage, totalPages } = paginate(data, page, size);

        expect(effectivePage).toBeGreaterThanOrEqual(1);
        expect(effectivePage).toBeLessThanOrEqual(totalPages);
      }),
      RUNS,
    );
  });
});
