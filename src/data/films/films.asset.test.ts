import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards over the committed film dataset itself.
 *
 * What goes undetected without this file: a regenerated asset that drifts in
 * shape, loses one of the quirks the row shape was chosen for, or is
 * re-serialized in a form that stops being reviewable. The loader has its own
 * suite, but every case there runs against a fixture, so this is the only place
 * the real committed artifact is checked.
 *
 * The predicates below are written out rather than snapshotted. A snapshot over
 * thousands of rows is accepted reflexively instead of read, and the point of
 * this file is that a human decided what has to hold.
 */

// Resolved from this file's own location rather than from the working directory,
// which is wherever the runner happened to be invoked and is not the project
// root under an IDE runner or an explicit root argument.
const here = import.meta as ImportMeta & { dirname: string };
const assetPath = join(here.dirname, "films.json");

// Read and parsed once, then shared. Every case below reads the same artifact.
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
  "title",
  "year",
  "runtime",
  "directors",
  "genres",
  "countries",
];

// A tuple rather than an array, so an index into a row carries the type at that
// position instead of a possibly-absent one.
type AssetRow = [
  string,
  string,
  number | null,
  number | null,
  string[],
  string[],
  string[],
];

// The query date plus this repository's own revision of it. Wikidata publishes
// no release number, so the date is the only stable upstream identifier.
const EXPECTED_VERSION = /^\d{4}-\d{2}-\d{2}\+r\d+$/;

// Wikidata entity ids. The generator takes the tail segment of the entity URI,
// so anything else means it mapped the wrong binding.
const Q_ID = /^Q[1-9]\d*$/;

// A floor rather than an equality, so a re-export from a live database fails
// this suite only for a real reason.
const MINIMUM_ROW_COUNT = 8000;

// The three fields GROUP_CONCAT returns pipe-joined and the generator splits
// once, paired with their index in the row.
const MULTI_VALUED = [
  { name: "directors", at: 4 },
  { name: "genres", at: 5 },
  { name: "countries", at: 6 },
] as const;

// The envelope's own lines: the opening brace, the version, the columns, the
// rows key, the closing bracket, and the closing brace. Every remaining line
// holds exactly one row, so the count is exact rather than a bound.
const ENVELOPE_NEWLINE_COUNT = 6;

describe("committed film dataset", () => {
  it("declares the expected envelope and column order", () => {
    expect(Object.keys(asset).sort()).toEqual(["columns", "rows", "version"]);
    expect(asset.columns).toEqual(EXPECTED_COLUMNS);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("declares a version of the query-date-plus-revision form", () => {
    expect(asset.version).toMatch(EXPECTED_VERSION);
  });

  it("holds at least the minimum row count", () => {
    expect(rows.length).toBeGreaterThanOrEqual(MINIMUM_ROW_COUNT);
  });

  it("stores every row as a seven-element tuple", () => {
    const offenders = rows
      .map((row, at) =>
        Array.isArray(row) && row.length === EXPECTED_COLUMNS.length
          ? null
          : `row ${at} is not a ${EXPECTED_COLUMNS.length}-element tuple`,
      )
      .filter((offender) => offender !== null);

    expect(offenders.slice(0, 10)).toEqual([]);
  });

  it("gives every row a distinct Wikidata id", () => {
    const ids = rows.map((row) => (row as AssetRow)[0]);
    const malformed = ids.filter(
      (id) => typeof id !== "string" || !Q_ID.test(id),
    );

    expect(malformed.slice(0, 10)).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every row a non-empty title", () => {
    const offenders: string[] = [];

    rows.forEach((row, at) => {
      const title = (row as AssetRow)[1];
      if (typeof title !== "string" || title.trim() === "") {
        offenders.push(`row ${at} has no title`);
      }
    });

    expect(offenders.slice(0, 10)).toEqual([]);
  });

  it("records year and runtime as either a number or null", () => {
    const offenders: string[] = [];

    rows.forEach((row, at) => {
      for (const [field, value] of [
        ["year", (row as AssetRow)[2]],
        ["runtime", (row as AssetRow)[3]],
      ] as const) {
        if (value !== null && !Number.isFinite(value)) {
          offenders.push(
            `row ${at} has a ${field} that is neither a number nor null`,
          );
        }
      }
    });

    expect(offenders.slice(0, 10)).toEqual([]);
  });

  // The case the cities asset has no counterpart for, and the one that guards a
  // decision this dataset took. A regeneration that reverted to the pipe-joined
  // strings the query returns would still parse and still typecheck at the JSON
  // boundary, and would move a split into a comparator and a cell renderer.
  it("stores every multi-valued field as an array of strings, never a string", () => {
    const offenders: string[] = [];

    rows.forEach((row, at) => {
      for (const { name, at: index } of MULTI_VALUED) {
        const value = (row as AssetRow)[index];
        if (!Array.isArray(value)) {
          offenders.push(`row ${at} stores ${name} as ${typeof value}`);
        } else if (value.some((entry) => typeof entry !== "string")) {
          offenders.push(`row ${at} has a non-string entry in ${name}`);
        }
      }
    });

    expect(offenders.slice(0, 10)).toEqual([]);
  });

  // The three shapes the rest of the phase is built to exercise. Without them
  // the asset renders correctly and proves nothing.
  it("keeps at least one row with a null runtime", () => {
    expect(rows.some((row) => (row as AssetRow)[3] === null)).toBe(true);
  });

  it("keeps at least one row with an empty list in each multi-valued field", () => {
    for (const { name, at } of MULTI_VALUED) {
      expect(
        rows.some((row) => (row as AssetRow)[at].length === 0),
        `no row carries an empty ${name} list`,
      ).toBe(true);
    }
  });

  it("keeps at least one row carrying two or more genres", () => {
    expect(rows.some((row) => (row as AssetRow)[5].length > 1)).toBe(true);
  });

  // This is the property that makes a single corrected film a one-line diff, and
  // it is the whole reason this payload shape was chosen over a more compact one.
  it("stores one row per line", () => {
    const lines = (rawAsset.match(/\n/g) ?? []).length;

    expect(lines).toBe(rows.length + ENVELOPE_NEWLINE_COUNT);
  });
});
