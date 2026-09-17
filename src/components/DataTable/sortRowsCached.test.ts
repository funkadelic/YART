import { describe, expect, it } from "vitest";

import { collatorFor } from "../../i18n/format";
import { columns } from "./column";
import { sortRows } from "./sortRows";
import { sortRowsCached } from "./sortRowsCached";

/** The same generic row shape the sortRows suite uses. */
interface Part {
  sku: string;
  region: string;
  weight: number;
}

/** A fresh builder per column, so every case owns its own cache key. */
const col = () => columns<Part>(collatorFor("en-US"));

/** Identity, as the module requires it: a string, unique per row. */
const partId = (part: Part) => part.sku;

/** Builds one row. */
function part(sku: string, region: string, weight: number): Part {
  return { sku, region, weight };
}

/** A region column whose reversed comparator counts its calls. */
function recordingColumn() {
  const calls = { count: 0 };

  const column = col().key("region", {
    label: "Region",
    compare: (a, b) => {
      calls.count += 1;
      return a === b ? 0 : a < b ? 1 : -1;
    },
  });

  return { column, calls };
}

describe("sortRowsCached", () => {
  it("hands back the same array when there is no column or direction", () => {
    const rows = [part("b", "south", 2), part("a", "north", 1)];
    const region = col().key("region", { label: "Region" });

    expect(sortRowsCached(rows, undefined, "asc", partId)).toBe(rows);
    expect(sortRowsCached(rows, region, null, partId)).toBe(rows);
  });

  it("returns the stored array for a repeat sort without comparing", () => {
    const { column, calls } = recordingColumn();
    const rows = [part("b", "south", 2), part("a", "north", 1)];

    const first = sortRowsCached(rows, column, "asc", partId);
    const count = calls.count;

    expect(sortRowsCached(rows, column, "asc", partId)).toBe(first);
    expect(calls.count).toBe(count);
  });

  it("orders a subset from the stored order in both directions", () => {
    const blank = part("d", "", 4);
    const tiedA = part("a", "north", 1);
    const tiedB = part("b", "north", 2);
    const rows = [
      part("e", "south", 5),
      tiedB,
      blank,
      part("c", "east", 3),
      tiedA,
    ];
    const region = col().key("region", { label: "Region" });
    const subset = [tiedB, blank, rows[0], tiedA];

    sortRowsCached(rows, region, "asc", partId);
    sortRowsCached(rows, region, "desc", partId);

    const asc = sortRowsCached(subset, region, "asc", partId).map(partId);
    const desc = sortRowsCached(subset, region, "desc", partId).map(partId);

    expect(asc).toEqual(sortRows(subset, region, "asc", partId).map(partId));
    expect(desc).toEqual(sortRows(subset, region, "desc", partId).map(partId));
    expect(asc).toEqual(["a", "b", "e", "d"]);
    expect(desc).toEqual(["e", "a", "b", "d"]);
  });

  it("serves a subset without calling a supplied comparator", () => {
    const { column, calls } = recordingColumn();
    const rows = [
      part("a", "north", 1),
      part("b", "south", 2),
      part("c", "east", 3),
      part("d", "north", 4),
    ];
    const subset = [rows[3], rows[0], rows[2]];

    sortRowsCached(rows, column, "asc", partId);
    sortRowsCached(rows, column, "desc", partId);
    const count = calls.count;

    const asc = sortRowsCached(subset, column, "asc", partId);
    const desc = sortRowsCached(subset, column, "desc", partId);
    expect(calls.count).toBe(count);

    expect(asc.map(partId)).toEqual(
      sortRows(subset, column, "asc", partId).map(partId),
    );
    expect(desc.map(partId)).toEqual(
      sortRows(subset, column, "desc", partId).map(partId),
    );
    // Reversed by the supplied comparator, so the default did not decide.
    expect(asc.map(partId)).toEqual(["a", "d", "c"]);
  });

  it("sorts rows the stored order does not cover, then serves the subset", () => {
    const { column, calls } = recordingColumn();
    const rows = [
      part("a", "north", 1),
      part("b", "south", 2),
      part("c", "east", 3),
    ];
    const subset = [rows[2], rows[0]];

    sortRowsCached(subset, column, "asc", partId);
    expect(sortRowsCached(rows, column, "asc", partId).map(partId)).toEqual(
      sortRows(rows, column, "asc", partId).map(partId),
    );

    const count = calls.count;
    expect(sortRowsCached(subset, column, "asc", partId).map(partId)).toEqual([
      "a",
      "c",
    ]);
    expect(calls.count).toBe(count);
  });

  it("does not serve an order stored under another row identity", () => {
    const region = col().key("region", { label: "Region" });
    const rows = [
      part("b", "north", 2),
      part("c", "north", 1),
      part("a", "north", 3),
    ];
    const byWeight = (row: Part) => String(row.weight);

    const warm = sortRowsCached(rows, region, "asc", partId);
    expect(warm.map(partId)).toEqual(["a", "b", "c"]);

    const other = sortRowsCached(rows, region, "asc", byWeight);
    expect(other.map(partId)).toEqual(["c", "b", "a"]);
    expect(other).not.toBe(warm);
  });

  it("never serves a row the stored order lacks because another repeated", () => {
    const region = col().key("region", { label: "Region" });
    const a = part("a", "north", 1);
    const b = part("b", "south", 2);
    const c = part("c", "east", 3);

    sortRowsCached([a, a, b], region, "asc", partId);
    const sorted = sortRowsCached([a, c], region, "asc", partId);

    expect(sorted).toEqual(sortRows([a, c], region, "asc", partId));
    expect(sorted).toHaveLength(2);
    expect(sorted).toContain(c);
  });

  it("keeps each locale's order apart over the same rows", () => {
    const names = ["Nzérékoré", "Oslo", "Ñuñoa", "Nuuk"];
    const rows = names.map((name, at) => part(String(at), name, at));
    const en = columns<Part>(collatorFor("en-US")).key("region", {
      label: "Region",
    });
    const es = columns<Part>(collatorFor("es-ES")).key("region", {
      label: "Region",
    });
    const regions = (column: typeof en) =>
      sortRowsCached(rows, column, "asc", partId).map((row) => row.region);

    expect(regions(en)).toEqual(["Ñuñoa", "Nuuk", "Nzérékoré", "Oslo"]);
    expect(regions(es)).toEqual(["Nuuk", "Nzérékoré", "Ñuñoa", "Oslo"]);
    expect(regions(en)).toEqual(["Ñuñoa", "Nuuk", "Nzérékoré", "Oslo"]);
  });
});
