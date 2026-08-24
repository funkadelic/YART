import { describe, expect, it } from "vitest";

import { columns } from "./column";
import { compareIdentities, sortRows } from "./sortRows";

/**
 * A row type this module could plausibly be handed and the application never
 * will be. The point of the module is that it knows nothing about what it is
 * ordering, so its own tests say nothing about the application's rows either.
 */
interface Part {
  sku: string;
  region: string;
  weight: number;
}

const col = columns<Part>();

const REGION = col.key("region", { label: "Region" });
const WEIGHT = col.key("weight", { label: "Weight" });

/** Identity, as the module requires it: a string, unique per row. */
const partId = (part: Part) => part.sku;

function part(sku: string, region: string, weight: number): Part {
  return { sku, region, weight };
}

/**
 * A column whose comparator records every call. Used both to prove a supplied
 * comparator replaces the default and to prove the module does not call one at
 * all when there is nothing to order.
 */
function recordingColumn() {
  const calls: Array<[string, string, string]> = [];

  const column = col.key("region", {
    label: "Region",
    compare: (a, b, direction) => {
      calls.push([a, b, direction]);
      // Deliberately the reverse of the default, so a passing ordering
      // assertion cannot be explained by the default having run instead.
      return a === b ? 0 : a < b ? 1 : -1;
    },
  });

  return { column, calls };
}

describe("sortRows", () => {
  it("returns an empty set without consulting the column", () => {
    const { column, calls } = recordingColumn();

    expect(sortRows([], column, "asc", partId)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("returns a single row without consulting the column", () => {
    const { column, calls } = recordingColumn();
    const rows = [part("a", "north", 1)];

    expect(sortRows(rows, column, "asc", partId)).toEqual(rows);
    expect(calls).toEqual([]);
  });

  it("hands back the same array when there is no direction", () => {
    const rows = [part("b", "south", 2), part("a", "north", 1)];

    // Identity, not equality: an unsorted table should not pay for a copy.
    expect(sortRows(rows, REGION, null, partId)).toBe(rows);
  });

  it("hands back the same array when there is no column", () => {
    const rows = [part("b", "south", 2), part("a", "north", 1)];

    expect(sortRows(rows, undefined, "asc", partId)).toBe(rows);
  });

  it("leaves the array it was given in its original order", () => {
    const rows = [part("b", "south", 2), part("a", "north", 1)];

    const sorted = sortRows(rows, REGION, "asc", partId);

    expect(sorted).not.toBe(rows);
    expect(rows.map(partId)).toEqual(["b", "a"]);
    expect(sorted.map(partId)).toEqual(["a", "b"]);
  });

  it("breaks a tie on ascending identity in both directions", () => {
    // Same region on every row, so the column comparator decides nothing and
    // the tiebreak decides everything. It is never flipped, which is what makes
    // the two directions agree here.
    const rows = [
      part("c", "north", 3),
      part("a", "north", 1),
      part("b", "north", 2),
    ];

    expect(sortRows(rows, REGION, "asc", partId).map(partId)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(sortRows(rows, REGION, "desc", partId).map(partId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("produces the same order whichever order the rows arrive in", () => {
    // The set a search returns arrives in a different order every time, so an
    // ordering that depended on arrival would reshuffle rows the user did not
    // touch.
    const north = part("a", "north", 1);
    const south = part("b", "south", 2);
    const east = part("c", "east", 3);

    const expected = ["c", "a", "b"];

    expect(sortRows([north, south, east], REGION, "asc", partId)).toEqual(
      sortRows([east, north, south], REGION, "asc", partId),
    );
    expect(
      sortRows([south, east, north], REGION, "asc", partId).map(partId),
    ).toEqual(expected);
  });

  it("uses a column's own comparator instead of the default", () => {
    const { column, calls } = recordingColumn();
    const rows = [part("a", "north", 1), part("b", "south", 2)];

    const sorted = sortRows(rows, column, "asc", partId);

    expect(calls.length).toBeGreaterThan(0);
    // The default would order north before south ascending. The supplied
    // comparator reverses that, so this order can only come from it.
    expect(sorted.map(partId)).toEqual(["b", "a"]);
  });

  it("passes a column's own comparator the direction it was called with", () => {
    const { column, calls } = recordingColumn();
    const rows = [part("a", "north", 1), part("b", "south", 2)];

    sortRows(rows, column, "desc", partId);

    // Which of the two rows the engine passes first is its business; that both
    // reached the comparator, and that the direction came with them, is not.
    expect(calls.length).toBeGreaterThan(0);
    for (const [first, second, direction] of calls) {
      expect([first, second].sort()).toEqual(["north", "south"]);
      expect(direction).toBe("desc");
    }
  });

  it("orders blanks last in both directions with the default comparator", () => {
    // The rule that breaks if the direction is applied by negating a
    // direction-free comparator: blanks would lead the descending page.
    const rows = [
      part("a", "", 1),
      part("b", "north", 2),
      part("c", "south", 3),
    ];

    expect(sortRows(rows, REGION, "asc", partId).map(partId)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(sortRows(rows, REGION, "desc", partId).map(partId)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("orders a numeric column by value rather than as text", () => {
    // Nine before ten, which a text ordering would reverse. The default
    // comparator is what decides this, so the case also pins that the factory
    // wired one in.
    const rows = [part("a", "north", 10), part("b", "south", 9)];

    expect(sortRows(rows, WEIGHT, "asc", partId).map(partId)).toEqual([
      "b",
      "a",
    ]);
    expect(sortRows(rows, WEIGHT, "desc", partId).map(partId)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("compareIdentities", () => {
  it("orders two identities the way their text orders", () => {
    expect(compareIdentities("a", "b")).toBe(-1);
    expect(compareIdentities("b", "a")).toBe(1);
  });

  // The caller owes the table an injective identity, so this arm answers a
  // broken one rather than a legitimate tie. It reports equal instead of
  // picking a winner, which leaves the surrounding sort's order untouched
  // rather than making one up from rows it cannot tell apart.
  it("reports two equal identities as equal", () => {
    expect(compareIdentities("a", "a")).toBe(0);
  });
});
