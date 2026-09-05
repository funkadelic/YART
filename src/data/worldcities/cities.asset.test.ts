import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards over the committed dataset itself.
 *
 * Without this file, a regenerated asset can drift in shape, lose one of the
 * upstream quirks the generator deliberately preserves, or be re-serialized in
 * a form that stops being reviewable, and no other case would catch it. The
 * loader has its own suite, but every case there runs against a fixture, so
 * this is the only place the real committed artifact is checked.
 *
 * The predicates below are written out. A snapshot over fifty thousand rows is
 * accepted reflexively instead of read, and the point of this file is that a
 * human decided what has to hold.
 */

// Resolved from this file's own location, because the working directory is
// wherever the runner happened to be invoked and is not the project root under
// an IDE runner or an explicit root argument.
const here = import.meta as ImportMeta & { dirname: string };
const assetPath = join(here.dirname, "cities.json");

// Read and parsed once, then shared. Every case below reads the same artifact,
// and parsing it per case would cost several seconds for no added coverage.
const rawAsset = readFileSync(assetPath, "utf8");
const asset = JSON.parse(rawAsset) as {
  version?: unknown;
  columns?: unknown;
  rows?: unknown;
};
const rows = asset.rows as unknown[];

/** The order the loader asserts on. The two must agree or nothing loads. */
const EXPECTED_COLUMNS = [
  "id",
  "name",
  "nameAscii",
  "country",
  "countryIso3",
  "capital",
  "population",
];

// A tuple, so an index into a row carries the type at that position instead of
// a possibly-absent one. The order is the one the case
// below holds the asset's own columns array to, so the two cannot drift apart
// without that case reporting it first.
type AssetRow = [number, string, string, string, string, string, number];

// The upstream release plus this repository's own revision of it, so a
// regenerated asset from the same release is still distinguishable.
const EXPECTED_VERSION = /^\d+\.\d+\.\d+\+r\d+$/;

// A floor, so a future dataset bump fails this suite only for a real reason.
const MINIMUM_ROW_COUNT = 50000;

// Two upstream rows carry no id and are assigned these. Both are deliberate.
const SYNTHETIC_IDS = new Set([1, 2]);

// The lowest real upstream id, recorded in the loader's own header comment. The
// two synthetic ids sit far below it, which is why they cannot collide.
const UPSTREAM_ID_FLOOR = 1004003059;

// Measured against the committed asset, not copied from prose. Several planning
// notes and the pre-existing source comment recorded 424, which was wrong. On a
// dataset bump, re-measure this number instead of relaxing the assertion. The
// quirk is worth documenting precisely because it is easy to mistake for
// missing data.
const ZERO_POPULATION_ROWS = 432;

// The envelope's own lines: the opening brace, the version, the columns, the
// rows key, the closing bracket, and the closing brace. Every remaining line
// holds exactly one row, so the count is exact and not a bound. A range here
// would let rows merge onto one line and still pass, which is what this
// constant catches.
const ENVELOPE_NEWLINE_COUNT = 6;

describe("committed city dataset", () => {
  it("declares the expected envelope and column order", () => {
    expect(Object.keys(asset).sort()).toEqual(["columns", "rows", "version"]);
    expect(asset.columns).toEqual(EXPECTED_COLUMNS);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("declares a version of the release-plus-revision form", () => {
    expect(asset.version).toMatch(EXPECTED_VERSION);
  });

  it("holds at least the minimum row count", () => {
    expect(rows.length).toBeGreaterThanOrEqual(MINIMUM_ROW_COUNT);
  });

  it("stores every row as a seven-element tuple of the expected types", () => {
    const offenders: string[] = [];

    rows.forEach((row, at) => {
      if (!Array.isArray(row) || row.length !== EXPECTED_COLUMNS.length) {
        offenders.push(
          `row ${at} is not a ${EXPECTED_COLUMNS.length}-element tuple`,
        );
        return;
      }

      const [id, name, nameAscii, country, countryIso3, capital, population] =
        row as unknown[];

      if (typeof id !== "number")
        offenders.push(`row ${at} has a non-numeric id`);
      if (typeof population !== "number") {
        offenders.push(`row ${at} has a non-numeric population`);
      }

      for (const [field, value] of [
        ["name", name],
        ["nameAscii", nameAscii],
        ["country", country],
        ["countryIso3", countryIso3],
        ["capital", capital],
      ] as const) {
        if (typeof value !== "string") {
          offenders.push(`row ${at} has a non-string ${field}`);
        }
      }
    });

    expect(offenders.slice(0, 10)).toEqual([]);
  });

  // The capital field is deliberately not checked here, because most rows
  // legitimately carry none and asserting it non-empty would fail on correct
  // data.
  it("gives every row a name, an ascii name, and a country", () => {
    const offenders: string[] = [];

    rows.forEach((row, at) => {
      const [, name, nameAscii, country] = row as AssetRow;

      for (const [field, value] of [
        ["name", name],
        ["nameAscii", nameAscii],
        ["country", country],
      ] as const) {
        if (value.trim() === "")
          offenders.push(`row ${at} has an empty ${field}`);
      }
    });

    expect(offenders.slice(0, 10)).toEqual([]);
  });

  // At or above zero, never above zero. Rows with no reported population are
  // recorded as zero upstream and are kept that way, so a stricter predicate
  // would flag correct data as corrupt.
  it("records every population at or above zero, and keeps the zero rows", () => {
    const populations = rows.map((row) => (row as AssetRow)[6]);
    const belowZero = populations.filter((population) => population < 0);
    const atZero = populations.filter((population) => population === 0);

    expect(belowZero).toEqual([]);
    expect(
      atZero.length,
      `rows recording zero population: ${atZero.length}, expected ${ZERO_POPULATION_ROWS}`,
    ).toBe(ZERO_POPULATION_ROWS);
  });

  it("gives every row a unique id", () => {
    const ids = rows.map((row) => (row as AssetRow)[0]);

    expect(new Set(ids).size).toBe(ids.length);
  });

  // The two synthetic ids exist because two upstream rows carry no id at all.
  // They are accepted by name, so a third small id still fails here. A blanket
  // lower bound would admit it, and it would mean a generator that silently
  // invented an id.
  it("keeps every id either synthetic or at or above the upstream floor", () => {
    const stray = rows
      .map((row) => (row as AssetRow)[0])
      .filter((id) => id < UPSTREAM_ID_FLOOR && !SYNTHETIC_IDS.has(id));

    expect(stray).toEqual([]);
  });

  // A single corrected city stays a one-line diff only while this holds, and
  // that is why the payload shape was chosen over a more compact one. A
  // re-serialization that collapses the rows onto one line costs nothing at
  // runtime and quietly ends reviewability.
  it("stores one row per line", () => {
    const lines = (rawAsset.match(/\n/g) ?? []).length;

    expect(lines).toBe(rows.length + ENVELOPE_NEWLINE_COUNT);
  });
});
