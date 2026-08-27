import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { columns } from "../components/DataTable/column";
import { useSortedRows } from "./useSortedRows";
import { required } from "../test/required";

interface Widget {
  id: string;
  name: string;
}

const col = columns<Widget>();

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
 * case can assert that two renders handed back the same array rather than two
 * equal ones. A new-but-equal array is what reshuffles the table between
 * renders, and deep equality cannot see it.
 */
function renderSorted(initialProps: Props) {
  const seen: (readonly Widget[])[] = [];

  const view = renderHook(
    ({ rows, columnId, direction }: Props) => {
      const sorted = useSortedRows(
        rows,
        WIDGET_COLUMNS,
        columnId,
        direction,
        widgetId,
      );
      seen.push(sorted);
      return sorted;
    },
    { initialProps },
  );

  return { ...view, seen };
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
});
