import { describe, expect, it } from "vitest";

import { paginate } from "./paginate";

// Plain rows declared here rather than imported from a fixture: the module is
// generic over its row type and nothing about paging reads a field, so a
// domain row would only add noise to the expectations.
const ROWS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];

const PAGE_SIZE = 4;

describe("paginate", () => {
  it("counts an empty collection as a single page and returns an empty slice", () => {
    const { paginatedData, totalPages, effectivePage } = paginate([], 1, 10);

    expect(totalPages).toBe(1);
    expect(effectivePage).toBe(1);
    expect(paginatedData).toEqual([]);
  });

  it("fits a single row into one page", () => {
    const { paginatedData, totalPages } = paginate(["only"], 1, 10);

    expect(totalPages).toBe(1);
    expect(paginatedData).toEqual(["only"]);
  });

  it("reads a page below one as the first page", () => {
    const { paginatedData, effectivePage } = paginate(ROWS, 0, PAGE_SIZE);

    expect(effectivePage).toBe(1);
    expect(paginatedData).toEqual(["a", "b", "c", "d"]);
  });

  it("reads a page past the last one as the last page", () => {
    const { paginatedData, effectivePage, totalPages } = paginate(
      ROWS,
      99,
      PAGE_SIZE,
    );

    expect(totalPages).toBe(3);
    expect(effectivePage).toBe(3);
    expect(paginatedData).toEqual(["i", "j", "k"]);
  });

  it("restores an out-of-range position once the collection grows back under it", () => {
    // The clamp is a read, not a write. Nothing here hands the caller a
    // corrected page to store, so the same position against a wider collection
    // is the page the user was on rather than the page a narrowed set allowed.
    const page = 3;
    const narrowed = paginate(ROWS.slice(0, 2), page, PAGE_SIZE);
    const widened = paginate(ROWS, page, PAGE_SIZE);

    expect(narrowed.effectivePage).toBe(1);
    expect(widened.effectivePage).toBe(3);
  });

  it("reads a page equal to the last one unchanged", () => {
    const { effectivePage } = paginate(ROWS, 3, PAGE_SIZE);

    expect(effectivePage).toBe(3);
  });

  it("reads the first page unchanged", () => {
    const { effectivePage } = paginate(ROWS, 1, PAGE_SIZE);

    expect(effectivePage).toBe(1);
  });

  it("does not add a trailing empty page when the count divides exactly", () => {
    const exact = ROWS.slice(0, 8);
    const { totalPages, paginatedData } = paginate(exact, 2, PAGE_SIZE);

    expect(totalPages).toBe(2);
    expect(paginatedData).toEqual(["e", "f", "g", "h"]);
  });

  it("puts the remainder on the last page when the count divides inexactly", () => {
    const { paginatedData } = paginate(ROWS, 3, PAGE_SIZE);

    expect(paginatedData).toEqual(["i", "j", "k"]);
  });

  it("preserves the order it was given", () => {
    const reversed = [...ROWS].reverse();
    const { paginatedData } = paginate(reversed, 1, PAGE_SIZE);

    expect(paginatedData).toEqual(["k", "j", "i", "h"]);
  });

  it("leaves the collection it was given untouched", () => {
    const input = [...ROWS];

    paginate(input, 2, PAGE_SIZE);

    expect(input).toEqual(ROWS);
  });
});
