import { describe, it, expect, vi } from "vitest";

import type { DatasetErrorCode } from "../../api/getFilms";
import { FILM_FIXTURE_ENVELOPE } from "../../test/filmFixture";
import { stubDatasetFetch } from "../../test/fetchStub";

/**
 * Guards over the half of the parse boundary that is this dataset's own: the
 * per-row typecheck and the two values it must not quietly change. The
 * transport, status, JSON and envelope-shape boundaries are shared by every
 * dataset and are covered in src/data/loadEnvelope.test.ts.
 *
 * Every case starts from the known-good fixture envelope and changes exactly
 * one thing, so the case name and the mutation line together say what is being
 * rejected. Every case asserts the message it expects, because a case that
 * accepts any rejection passes when the load failed for an unrelated reason.
 * The messages are written here as literals and not imported from the loader,
 * so a rename cannot move both sides at once.
 */

/**
 * A cold copy of the loader. The dataset promise is cached in the loader this
 * module builds at import time and that cache survives between tests inside one
 * file, so a plain re-import returns an already-populated cache and never
 * reaches the parse boundary at all.
 */
async function freshFilms() {
  vi.resetModules();
  return await import("./films");
}

/** The loader alone, for the cases that need nothing else from the module. */
async function freshLoadFilms() {
  return (await freshFilms()).loadFilms;
}

interface Envelope {
  version: string;
  columns: unknown;
  rows: unknown;
}

/**
 * A fresh, valid envelope for each case to spoil in exactly one way.
 */
function envelope(): Envelope {
  return JSON.parse(JSON.stringify(FILM_FIXTURE_ENVELOPE)) as Envelope;
}

function rowsOf(payload: Envelope): unknown[] {
  return payload.rows as unknown[];
}

function rowAt(payload: Envelope, at: number): unknown[] {
  return rowsOf(payload)[at] as unknown[];
}

/**
 * The message and the code a load rejected with. Resolving is itself a failure
 * here and is reported as one, so no later assertion has to trip over an
 * undefined value.
 */
async function rejection(
  payload: unknown,
): Promise<{ message: string; code: DatasetErrorCode | undefined }> {
  stubDatasetFetch(payload);
  const films = await freshFilms();

  try {
    await films.loadFilms();
  } catch (error) {
    // The class is read off the freshly loaded module, not imported at the top
    // of this file. Every case here resets the module registry, which
    // hands the loader a new class object each time, and a class imported once
    // would stop recognizing its own instances after the first reset.
    if (error instanceof films.DatasetError) {
      return { message: error.message, code: error.code };
    }
    return {
      message: error instanceof Error ? error.message : String(error),
      code: undefined,
    };
  }

  throw new Error("The load resolved when it was expected to reject.");
}

/**
 * The error a load rejected with, for the cases that assert more than a message.
 */
async function rejectionOf(
  films: typeof import("./films"),
): Promise<InstanceType<typeof films.DatasetError>> {
  try {
    await films.loadFilms();
  } catch (error) {
    if (error instanceof films.DatasetError) return error;
    throw new Error(
      `The load rejected with something other than a dataset error: ${String(error)}`,
      { cause: error },
    );
  }

  throw new Error("The load resolved when it was expected to reject.");
}

describe("loadFilms row validation", () => {
  it("rejects a row that is not an array, naming its index", async () => {
    const payload = envelope();
    rowsOf(payload)[3] = "Q2345, 12 Angry Men, 1957";

    expect(await rejection(payload)).toEqual({
      message: "Film row 3 does not have 7 fields and was not loaded.",
      code: "rowShape",
    });
  });

  it("rejects a row with one field too few, naming its index", async () => {
    const payload = envelope();
    rowsOf(payload)[2] = rowAt(payload, 2).slice(0, 6);

    expect(await rejection(payload)).toEqual({
      message: "Film row 2 does not have 7 fields and was not loaded.",
      code: "rowShape",
    });
  });

  it("rejects a row with one field too many, naming its index", async () => {
    const payload = envelope();
    rowsOf(payload)[4] = [...rowAt(payload, 4), ["Sweden"]];

    expect(await rejection(payload)).toEqual({
      message: "Film row 4 does not have 7 fields and was not loaded.",
      code: "rowShape",
    });
  });

  it("rejects a row whose identifier is not a string", async () => {
    const payload = envelope();
    rowAt(payload, 5)[0] = 3589;

    expect(await rejection(payload)).toEqual({
      message: "Film row 5 has a field of the wrong type and was not loaded.",
      code: "rowFieldType",
    });
  });

  it("rejects a row whose title is not a string", async () => {
    const payload = envelope();
    rowAt(payload, 1)[1] = 1974;

    expect(await rejection(payload)).toEqual({
      message: "Film row 1 has a field of the wrong type and was not loaded.",
      code: "rowFieldType",
    });
  });

  it("rejects a row whose year is neither a number nor null", async () => {
    const payload = envelope();
    rowAt(payload, 6)[2] = "1963";

    expect(await rejection(payload)).toEqual({
      message: "Film row 6 has a field of the wrong type and was not loaded.",
      code: "rowFieldType",
    });
  });

  it("rejects a row whose runtime is neither a number nor null", async () => {
    const payload = envelope();
    rowAt(payload, 0)[3] = "112";

    expect(await rejection(payload)).toEqual({
      message: "Film row 0 has a field of the wrong type and was not loaded.",
      code: "rowFieldType",
    });
  });

  it("rejects a row whose multi-valued field is not an array", async () => {
    const payload = envelope();
    rowAt(payload, 2)[4] = "Matthew Vaughn";

    expect(await rejection(payload)).toEqual({
      message: "Film row 2 has a field of the wrong type and was not loaded.",
      code: "rowFieldType",
    });
  });

  // The case the film shape makes necessary and the city shape did not. An
  // array of numbers is still an array, so a check that only asked whether the
  // field was one would let a genre list of identifiers through to a cell.
  it("rejects a row whose multi-valued field holds something other than strings", async () => {
    const payload = envelope();
    rowAt(payload, 4)[5] = ["drama film", 1939];

    expect(await rejection(payload)).toEqual({
      message: "Film row 4 has a field of the wrong type and was not loaded.",
      code: "rowFieldType",
    });
  });

  it("carries the failing row's index as the detail, not only in the message", async () => {
    const payload = envelope();
    rowsOf(payload)[3] = "Q2345, 12 Angry Men, 1957";
    stubDatasetFetch(payload);
    const films = await freshFilms();

    const error = await rejectionOf(films);

    expect(error.code).toBe("rowShape");
    expect(error.detail).toBe(3);
  });
});

describe("loadFilms envelope wiring", () => {
  it("names the film dataset in the messages the shared loader throws", async () => {
    // The shared loader takes the dataset's name for its own six messages, and
    // the row cases above cannot see it being handed the wrong one. The status
    // boundary itself is covered in src/data/loadEnvelope.test.ts; what this
    // case adds is that the name reaching it is this dataset's.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("the film data, honestly", { status: 500 }),
    );
    const films = await freshFilms();

    const error = await rejectionOf(films);

    expect(error.message).toBe(
      "The film data could not be downloaded (status 500).",
    );
    expect(error.code).toBe("status");
  });
});

describe("loadFilms values", () => {
  // Neither of the two below is visible from a rendered cell: a truncated
  // runtime still paints a number and a year that became zero still paints a
  // year. Both are properties of the parse and are asserted here or nowhere.
  it("keeps a fractional runtime as it was published", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    const loadFilms = await freshLoadFilms();

    const rows = await loadFilms();
    const fractional = rows.find(
      (film) => film.runtime !== null && !Number.isInteger(film.runtime),
    );
    if (!fractional) {
      throw new Error(
        "The fixture no longer carries a row with a fractional runtime.",
      );
    }

    expect(fractional.runtime).toBe(161.25);
  });

  it("keeps an absent year and an absent runtime as null rather than zero", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    const loadFilms = await freshLoadFilms();

    const rows = await loadFilms();
    const unreleased = rows.find((film) => film.year === null);
    if (!unreleased) {
      throw new Error("The fixture no longer carries a row with no year.");
    }

    expect(unreleased.year).toBeNull();
    expect(unreleased.runtime).toBeNull();
  });

  // The query groups the multi-valued properties and SPARQL promises no order
  // within a group, so the asset's order is arbitrary and a regeneration may
  // permute it. Sorting at the boundary keeps both the cell text and the
  // column's order reproducible, and it is invisible from a rendered cell.
  it("sorts every multi-valued field, whatever order the asset holds", async () => {
    const scrambled = {
      ...FILM_FIXTURE_ENVELOPE,
      rows: [
        [
          "Q1",
          "A Film",
          2000,
          100,
          ["Zoe", "Adil", "Zoe"],
          ["war", "epic"],
          ["Peru", "Chad"],
        ],
      ],
    };
    stubDatasetFetch(scrambled);
    const loadFilms = await freshLoadFilms();

    const [row] = await loadFilms();

    expect(row?.directors).toEqual(["Adil", "Zoe", "Zoe"]);
    expect(row?.genres).toEqual(["epic", "war"]);
    expect(row?.countries).toEqual(["Chad", "Peru"]);
  });

  // The two ends of the range the committed asset actually spans, so a check
  // that ever grew a plausible-year rule would have to be written against the
  // real data and not against a guess at it.
  it("parses the earliest and the latest year the fixture carries", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    const loadFilms = await freshLoadFilms();

    const rows = await loadFilms();
    const years = rows
      .map((film) => film.year)
      .filter((year): year is number => year !== null);

    expect(Math.min(...years)).toBe(1911);
    expect(Math.max(...years)).toBe(2026);
  });
});
