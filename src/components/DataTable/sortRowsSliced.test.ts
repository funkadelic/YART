import { describe, expect, it, vi } from "vitest";

import { collatorFor } from "../../i18n/format";
import { columns } from "./column";
import { sortRows } from "./sortRows";
import { sortRowsSliced } from "./sortRowsSliced";

/** The same generic row shape the sortRows suite uses. */
interface Part {
  sku: string;
  region: string;
  weight: number;
}

/** A fresh builder per column, since a builder rejects a repeated id. */
const col = () => columns<Part>(collatorFor("en-US"));

/** Identity, as the module requires it: a string, unique per row. */
const partId = (part: Part) => part.sku;

/** Never cancelled. */
const running = () => false;

/** Builds one row. */
function part(sku: string, region: string, weight: number): Part {
  return { sku, region, weight };
}

/** A clock past the slice deadline on every read, so every step yields. */
function stubSlowClock(): void {
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => (clock += 10));
}

/** Blanks and tied regions, arriving out of order. */
const MIXED = [
  part("e", "south", 5),
  part("b", "north", 2),
  part("d", "", 4),
  part("c", "east", 3),
  part("a", "north", 1),
  part("f", "", 6),
  part("g", "east", 7),
];

describe("sortRowsSliced", () => {
  it("matches sortRows across merge passes in both directions", async () => {
    const region = col().key("region", { label: "Region" });

    for (const direction of ["asc", "desc"] as const) {
      const sliced = await sortRowsSliced(
        MIXED,
        region,
        direction,
        partId,
        running,
        2,
      );

      expect(sliced?.map(partId)).toEqual(
        sortRows(MIXED, region, direction, partId).map(partId),
      );
    }
  });

  it("lets a supplied comparator decide the order", async () => {
    const region = col().key("region", {
      label: "Region",
      compare: (a, b) => (a === b ? 0 : a < b ? 1 : -1),
    });

    const sliced = await sortRowsSliced(
      MIXED,
      region,
      "asc",
      partId,
      running,
      2,
    );

    expect(sliced?.map(partId)).toEqual(
      sortRows(MIXED, region, "asc", partId).map(partId),
    );
    expect(sliced?.map(partId)).toEqual(["e", "a", "b", "c", "g", "d", "f"]);
  });

  it("matches sortRows over rows wider than a merge step", async () => {
    const weight = col().key("weight", { label: "Weight" });
    const rows = Array.from({ length: 2100 }, (_, at) =>
      part(String((at * 7) % 2100).padStart(4, "0"), "", at % 13),
    );

    const sliced = await sortRowsSliced(rows, weight, "desc", partId, running);

    expect(sliced?.map(partId)).toEqual(
      sortRows(rows, weight, "desc", partId).map(partId),
    );
  });

  it("resolves undefined once cancelled at a yield", async () => {
    stubSlowClock();
    const region = col().key("region", { label: "Region" });

    await expect(
      sortRowsSliced(MIXED, region, "asc", partId, () => true, 2),
    ).resolves.toBeUndefined();
  });

  it("yields through scheduler.yield where the platform has it", async () => {
    stubSlowClock();
    const yieldToMain = vi.fn(() => Promise.resolve());
    vi.stubGlobal("scheduler", { yield: yieldToMain });
    const region = col().key("region", { label: "Region" });

    const sliced = await sortRowsSliced(
      MIXED,
      region,
      "asc",
      partId,
      running,
      2,
    );

    expect(sliced?.map(partId)).toEqual(
      sortRows(MIXED, region, "asc", partId).map(partId),
    );
    expect(yieldToMain).toHaveBeenCalled();
  });
});
