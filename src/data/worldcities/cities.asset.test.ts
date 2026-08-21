import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards over the committed dataset itself.
 *
 * What goes undetected without this file: a regenerated asset that drifts in
 * shape, loses one of the upstream quirks the generator deliberately preserves,
 * or is re-serialized in a form that stops being reviewable. The loader has its
 * own suite, but every case there runs against a fixture, so this is the only
 * place the real committed artifact is checked.
 *
 * The predicates below are written out rather than snapshotted. A snapshot over
 * fifty thousand rows is accepted reflexively instead of read, and the point of
 * this file is that a human decided what has to hold.
 */

// Resolved from this file's own location rather than from the working directory,
// which is wherever the runner happened to be invoked and is not the project
// root under an IDE runner or an explicit root argument.
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

// The upstream release plus this repository's own revision of it, so a
// regenerated asset from the same release is still distinguishable.
const EXPECTED_VERSION = /^\d+\.\d+\.\d+\+r\d+$/;

// A floor rather than an equality, so a future dataset bump fails this suite
// only for a real reason.
const MINIMUM_ROW_COUNT = 50000;

// Two upstream rows carry no id and are assigned these. Both are deliberate.
const SYNTHETIC_IDS = new Set([1, 2]);

// The lowest real upstream id, recorded in the loader's own header comment. The
// two synthetic ids sit far below it, which is why they cannot collide.
const UPSTREAM_ID_FLOOR = 1004003059;

// Measured against the committed asset, not copied from prose. Several planning
// notes and the pre-existing source comment recorded 424, which was wrong. A
// dataset bump re-measures this number rather than relaxing the assertion:
// the quirk is worth documenting precisely because it is easy to mistake for
// missing data.
const ZERO_POPULATION_ROWS = 432;

// The envelope's own lines: the opening brace, the version, the columns, the
// rows key, the closing bracket, and the closing brace. Every remaining line
// holds exactly one row.
const ENVELOPE_LINE_ALLOWANCE = 10;

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

  // The capital field is deliberately not checked here: most rows legitimately
  // carry none, and asserting it non-empty would fail on correct data.
  it("gives every row a name, an ascii name, and a country", () => {
    const offenders: string[] = [];

    rows.forEach((row, at) => {
      const [, name, nameAscii, country] = row as string[];

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
    const populations = rows.map((row) => (row as number[])[6]);
    const belowZero = populations.filter((population) => population < 0);
    const atZero = populations.filter((population) => population === 0);

    expect(belowZero).toEqual([]);
    expect(
      atZero.length,
      `rows recording zero population: ${atZero.length}, expected ${ZERO_POPULATION_ROWS}`,
    ).toBe(ZERO_POPULATION_ROWS);
  });

  it("gives every row a unique id", () => {
    const ids = rows.map((row) => (row as number[])[0]);

    expect(new Set(ids).size).toBe(ids.length);
  });

  // The two synthetic ids exist because two upstream rows carry no id at all.
  // They are accepted by name rather than by a blanket lower bound, so a third
  // small id, which would mean a generator that silently invented one, still
  // fails here.
  it("keeps every id either synthetic or at or above the upstream floor", () => {
    const stray = rows
      .map((row) => (row as number[])[0])
      .filter((id) => id < UPSTREAM_ID_FLOOR && !SYNTHETIC_IDS.has(id));

    expect(stray).toEqual([]);
  });

  // This is the property that makes a single corrected city a one-line diff,
  // and it is the whole reason this payload shape was chosen over a more
  // compact one. A re-serialization that collapses the rows onto one line
  // costs nothing at runtime and quietly ends reviewability.
  it("stores one row per line", () => {
    const lines = (rawAsset.match(/\n/g) ?? []).length;

    expect(lines).toBeGreaterThanOrEqual(rows.length);
    expect(lines - rows.length).toBeLessThanOrEqual(ENVELOPE_LINE_ALLOWANCE);
  });
});
