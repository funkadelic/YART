import { renderHook, waitFor } from "@testing-library/react";
import { Component, createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { columns, type Column } from "../components/DataTable/column";
import { sortRows } from "../components/DataTable/sortRows";
import { cachedSortedRows } from "../components/DataTable/sortRowsCached";
import { collatorFor } from "../i18n/format";
import { SYNC_SORT_ROWS, useSortedRows } from "./useSortedRows";
import { required } from "../test/required";

interface Widget {
  id: string;
  name: string;
}

/**
 * A collator on the base tag. The factory holds none, so every caller states
 * which reader's ordering it is building for, and nothing in this file depends
 * on which tag that is, only on there being exactly one.
 */
const col = columns<Widget>(collatorFor("en-US"));

const WIDGET_COLUMNS = [col.key("name", { label: "Name" })];

const WIDGETS: Widget[] = [
  { id: "1", name: "beta" },
  { id: "2", name: "alpha" },
];

const widgetId = (widget: Widget) => widget.id;

type Direction = "asc" | "desc" | null;

interface Props {
  rows: readonly Widget[];
  columnId: "name" | null;
  direction: Direction;
}

/**
 * Renders the hook while recording the array it returns on every render, so a
 * case can assert that two renders handed back the identical array and not an
 * equal copy. A new-but-equal array reshuffles the table between renders, and
 * deep equality cannot see it.
 */
function renderSorted(initialProps: Props) {
  const seen: (readonly Widget[])[] = [];

  const view = renderHook(
    ({ rows, columnId, direction }: Props) => {
      const { sortedRows } = useSortedRows(
        rows,
        WIDGET_COLUMNS,
        columnId,
        direction,
        widgetId,
      );
      seen.push(sortedRows);
      return sortedRows;
    },
    { initialProps },
  );

  return { ...view, seen };
}

/** A fresh column per case, because the order cache is keyed on the column. */
function nameColumn() {
  return columns<Widget>(collatorFor("en-US")).key("name", { label: "Name" });
}

/** Widgets in a fixed shuffle, so arrival order is not sorted order. */
function widgets(count: number): Widget[] {
  // 7919 is prime and shares no factor with the counts used, so this permutes.
  return Array.from({ length: count }, (_, at) => {
    const key = String((at * 7919) % count).padStart(5, "0");
    return { id: key, name: `widget ${key}` };
  });
}

/** A clock past the slice deadline on every read, so a pass always yields. */
function stubSlowClock(): void {
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => (clock += 10));
}

interface LargeProps {
  rows: readonly Widget[];
  direction: Direction;
}

/** Renders the hook over one column, recording every render's whole result. */
function renderLarge(column: Column<Widget, "name">, initialProps: LargeProps) {
  const seen: ReturnType<typeof useSortedRows<Widget, "name">>[] = [];
  const all = [column];

  const view = renderHook(
    ({ rows, direction }: LargeProps) => {
      const result = useSortedRows(rows, all, "name", direction, widgetId);
      seen.push(result);
      return result;
    },
    { initialProps },
  );

  return { ...view, seen };
}

/** Reports what it catches and renders nothing in its place. */
class Boundary extends Component<{
  children?: ReactNode;
  onError: (error: Error) => void;
}> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

const SORTED_ASC: Props = { rows: WIDGETS, columnId: "name", direction: "asc" };

describe("useSortedRows", () => {
  it("sorts by the column the id names", () => {
    const { result } = renderSorted(SORTED_ASC);

    expect(result.current.map((widget) => widget.name)).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("returns the same array when nothing it depends on changed", () => {
    const { rerender, seen } = renderSorted(SORTED_ASC);

    rerender(SORTED_ASC);

    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });

  it("returns a new array when the direction changes", () => {
    const { rerender, seen } = renderSorted(SORTED_ASC);

    rerender({ ...SORTED_ASC, direction: "desc" });

    expect(seen[1]).not.toBe(seen[0]);
    expect(
      required(seen[1], "the rows from the second render").map(
        (widget) => widget.name,
      ),
    ).toEqual(["beta", "alpha"]);
  });

  it("returns a new array when the rows change", () => {
    const { rerender, seen } = renderSorted(SORTED_ASC);

    rerender({ ...SORTED_ASC, rows: [...WIDGETS] });

    expect(seen[1]).not.toBe(seen[0]);
  });

  it("holds nothing across a remount: the result is its arguments and nothing else", () => {
    const first = renderSorted({ ...SORTED_ASC, direction: "desc" });
    expect(first.result.current.map((widget) => widget.name)).toEqual([
      "beta",
      "alpha",
    ]);
    first.unmount();

    const second = renderSorted(SORTED_ASC);

    expect(second.result.current.map((widget) => widget.name)).toEqual([
      "alpha",
      "beta",
    ]);
  });

  describe("above the in-render limit", () => {
    it("sorts a set at the limit inside the first render", () => {
      const name = nameColumn();
      const rows = widgets(SYNC_SORT_ROWS);
      const { seen } = renderLarge(name, { rows, direction: "asc" });

      expect(seen[0]?.sorting).toBe(false);
      expect(seen[0]?.sortedRows.map(widgetId)).toEqual(
        sortRows(rows, name, "asc", widgetId).map(widgetId),
      );
    });

    it("holds the previous order while a cold sort runs, then settles", async () => {
      stubSlowClock();
      const name = nameColumn();
      const rows = widgets(SYNC_SORT_ROWS + 1);
      const { result, rerender } = renderLarge(name, {
        rows,
        direction: null,
      });

      rerender({ rows, direction: "asc" });

      expect(result.current.sorting).toBe(true);
      expect(result.current.sortedRows).toBe(rows);

      await waitFor(() => expect(result.current.sorting).toBe(false));
      expect(result.current.sortedRows.map(widgetId)).toEqual(
        sortRows(rows, name, "asc", widgetId).map(widgetId),
      );
    });

    it("drops a pass whose inputs changed before it finished", async () => {
      stubSlowClock();
      const name = nameColumn();
      const rows = widgets(SYNC_SORT_ROWS + 1);
      const { result, rerender, seen } = renderLarge(name, {
        rows,
        direction: null,
      });

      rerender({ rows, direction: "asc" });
      rerender({ rows, direction: "desc" });
      await waitFor(() => expect(result.current.sorting).toBe(false));

      const order = (direction: "asc" | "desc") =>
        sortRows(rows, name, direction, widgetId).map(widgetId).join();
      expect(result.current.sortedRows.map(widgetId).join()).toBe(
        order("desc"),
      );
      expect(
        seen.some(
          ({ sortedRows }) => sortedRows.map(widgetId).join() === order("asc"),
        ),
      ).toBe(false);
      expect(cachedSortedRows(rows, name, "asc", widgetId)).toBeUndefined();
    });

    it("drops a pass that finished without yielding once its inputs changed", async () => {
      // A clock that never passes the deadline, so each pass finishes before its cleanup.
      vi.spyOn(performance, "now").mockReturnValue(0);
      const name = nameColumn();
      const rows = widgets(SYNC_SORT_ROWS + 1);
      const { result, rerender } = renderLarge(name, {
        rows,
        direction: null,
      });

      rerender({ rows, direction: "asc" });
      rerender({ rows, direction: "desc" });
      await waitFor(() => expect(result.current.sorting).toBe(false));

      expect(cachedSortedRows(rows, name, "asc", widgetId)).toBeUndefined();
    });

    it("throws a failed pass to the nearest error boundary", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const failure = new Error("comparator broke");
      const broken = columns<Widget>(collatorFor("en-US")).key("name", {
        label: "Name",
        compare: () => {
          throw failure;
        },
      });
      const caught: Error[] = [];

      renderHook(
        () =>
          useSortedRows(
            widgets(SYNC_SORT_ROWS + 1),
            [broken],
            "name",
            "asc",
            widgetId,
          ),
        {
          wrapper: ({ children }) =>
            createElement(
              Boundary,
              { onError: (error) => caught.push(error) },
              children,
            ),
        },
      );

      await waitFor(() => expect(caught).toHaveLength(1));
      expect(caught[0]?.cause).toBe(failure);
    });

    it("serves a settled order from the cache on the next render", async () => {
      stubSlowClock();
      const name = nameColumn();
      const rows = widgets(SYNC_SORT_ROWS + 1);
      const { result, rerender, seen } = renderLarge(name, {
        rows,
        direction: "asc",
      });
      await waitFor(() => expect(result.current.sorting).toBe(false));
      const settled = result.current.sortedRows;

      rerender({ rows, direction: null });
      const first = seen.length;
      rerender({ rows, direction: "asc" });

      expect(seen[first]?.sorting).toBe(false);
      expect(seen[first]?.sortedRows).toBe(settled);
    });

    it("starts empty and sorting on a cold mount, then settles", async () => {
      stubSlowClock();
      const name = nameColumn();
      const rows = widgets(SYNC_SORT_ROWS + 1);
      const { result, seen } = renderLarge(name, { rows, direction: "desc" });

      expect(seen[0]).toEqual({ sortedRows: [], sorting: true });

      await waitFor(() => expect(result.current.sorting).toBe(false));
      expect(result.current.sortedRows.map(widgetId)).toEqual(
        sortRows(rows, name, "desc", widgetId).map(widgetId),
      );
    });
  });
});
