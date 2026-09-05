import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePaginatedRows } from "./usePaginatedRows";

const ROWS = ["a", "b", "c", "d", "e"];

interface Props {
  rows: readonly string[];
  page: number;
  pageSize: number;
}

/**
 * Renders the hook while recording the slice it returns on every render, so a
 * case can assert that two renders handed back one slice and not two equal
 * ones. A new-but-equal slice is a fresh set of table rows as far as React is
 * concerned, and deep equality cannot see it.
 */
function renderPaginated(initialProps: Props) {
  const seen: (readonly string[])[] = [];

  const view = renderHook(
    ({ rows, page, pageSize }: Props) => {
      const result = usePaginatedRows(rows, page, pageSize);
      seen.push(result.paginatedData);
      return result;
    },
    { initialProps },
  );

  return { ...view, seen };
}

const FIRST_PAGE: Props = { rows: ROWS, page: 1, pageSize: 2 };

describe("usePaginatedRows", () => {
  it("returns the page the arguments name, with the counts alongside it", () => {
    const { result } = renderPaginated(FIRST_PAGE);

    expect(result.current.paginatedData).toEqual(["a", "b"]);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.effectivePage).toBe(1);
  });

  it("returns the same slice when nothing it depends on changed", () => {
    const { rerender, seen } = renderPaginated(FIRST_PAGE);

    rerender(FIRST_PAGE);

    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });

  it("returns a new slice when the page changes", () => {
    const { rerender, seen } = renderPaginated(FIRST_PAGE);

    rerender({ ...FIRST_PAGE, page: 2 });

    expect(seen[1]).not.toBe(seen[0]);
    expect(seen[1]).toEqual(["c", "d"]);
  });

  it("returns a new slice when the page size changes", () => {
    const { rerender, seen } = renderPaginated(FIRST_PAGE);

    rerender({ ...FIRST_PAGE, pageSize: 3 });

    expect(seen[1]).not.toBe(seen[0]);
    expect(seen[1]).toEqual(["a", "b", "c"]);
  });

  it("holds nothing across a remount: the result is its arguments and nothing else", () => {
    const first = renderPaginated({ ...FIRST_PAGE, page: 3 });
    expect(first.result.current.paginatedData).toEqual(["e"]);
    first.unmount();

    const second = renderPaginated(FIRST_PAGE);

    expect(second.result.current.paginatedData).toEqual(["a", "b"]);
  });
});
