import { describe, it, expect, vi } from "vitest";

import type { City, DatasetErrorCode } from "../../api/getCities";
import { CITY_FIXTURE_ENVELOPE } from "../../test/cityFixture";
import { stubDatasetFetch } from "../../test/fetchStub";

/**
 * Guards over the half of the parse boundary that is this dataset's own: the
 * per-row typecheck and the derived search key. The transport, status, JSON and
 * envelope-shape boundaries are shared by every dataset and are covered in
 * src/data/loadEnvelope.test.ts.
 *
 * Every case starts from the known-good fixture envelope and changes exactly
 * one thing, so the case name and the mutation line together say what is being
 * rejected. Every case asserts the message it expects rather than the mere fact
 * of a rejection: a case that accepts any rejection passes when the load failed
 * for an unrelated reason, which is the specific way this kind of test goes
 * quietly wrong. The messages are written here as literals rather than imported
 * from the loader, so a rename cannot move both sides at once.
 */

/**
 * The separator the loader joins the derived key with, written out here rather
 * than imported for the same reason the messages are.
 */
const SEARCH_KEY_SEPARATOR = "\u0000";

/**
 * A cold copy of the loader. The dataset promise is cached in the loader this
 * module builds at import time and that cache survives between tests inside one
 * file, so a plain re-import returns an already-populated cache and never
 * reaches the parse boundary at all.
 */
async function freshCities() {
  vi.resetModules();
  return await import("./cities");
}

/** The loader alone, for the cases that need nothing else from the module. */
async function freshLoadCities() {
  return (await freshCities()).loadCities;
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
  return JSON.parse(JSON.stringify(CITY_FIXTURE_ENVELOPE)) as Envelope;
}

function rowsOf(payload: Envelope): unknown[] {
  return payload.rows as unknown[];
}

function rowAt(payload: Envelope, at: number): unknown[] {
  return rowsOf(payload)[at] as unknown[];
}

/**
 * The message and the code a load rejected with. Resolving is itself a failure
 * here, and it is reported as one rather than left to a later assertion on an
 * undefined value.
 *
 * The two travel together because they are asserted together everywhere: a
 * failure is the pair, and reading only one of them leaves the other free to
 * drift.
 */
async function rejection(
  payload: unknown,
): Promise<{ message: string; code: DatasetErrorCode | undefined }> {
  stubDatasetFetch(payload);
  const cities = await freshCities();

  try {
    await cities.loadCities();
  } catch (error) {
    // The class is read off the freshly loaded module rather than imported at
    // the top of this file. Every case here resets the module registry, which
    // hands the loader a new class object each time, and a class imported once
    // would stop recognizing its own instances after the first reset.
    if (error instanceof cities.DatasetError) {
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
 * Resolving is itself a failure here, and it is reported as one rather than left
 * to a later assertion on an undefined value.
 */
async function rejectionOf(
  cities: typeof import("./cities"),
): Promise<InstanceType<typeof cities.DatasetError>> {
  try {
    await cities.loadCities();
  } catch (error) {
    if (error instanceof cities.DatasetError) return error;
    throw new Error(
      `The load rejected with something other than a dataset error: ${String(error)}`,
      { cause: error },
    );
  }

  throw new Error("The load resolved when it was expected to reject.");
}

describe("loadCities row validation", () => {
  it("rejects a row that is not an array, naming its index", async () => {
    const payload = envelope();
    rowsOf(payload)[3] = "Manila, Philippines, 24922000";

    expect(await rejection(payload)).toEqual({
      message: "City row 3 does not have 7 fields and was not loaded.",
      code: "rowShape",
    });
  });

  it("rejects a row with one field too few, naming its index", async () => {
    const payload = envelope();
    rowsOf(payload)[2] = rowAt(payload, 2).slice(0, 6);

    expect(await rejection(payload)).toEqual({
      message: "City row 2 does not have 7 fields and was not loaded.",
      code: "rowShape",
    });
  });

  it("rejects a row with one field too many, naming its index", async () => {
    const payload = envelope();
    rowsOf(payload)[4] = [...rowAt(payload, 4), "admin"];

    expect(await rejection(payload)).toEqual({
      message: "City row 4 does not have 7 fields and was not loaded.",
      code: "rowShape",
    });
  });

  it("rejects a row whose id is the string form of its number", async () => {
    const payload = envelope();
    rowAt(payload, 5)[0] = String(rowAt(payload, 5)[0]);

    expect(await rejection(payload)).toEqual({
      message: "City row 5 has a field of the wrong type and was not loaded.",
      code: "rowFieldType",
    });
  });

  it("rejects a row whose population is null", async () => {
    const payload = envelope();
    rowAt(payload, 6)[6] = null;

    expect(await rejection(payload)).toEqual({
      message: "City row 6 has a field of the wrong type and was not loaded.",
      code: "rowFieldType",
    });
  });

  it("rejects a row whose name is a number", async () => {
    const payload = envelope();
    rowAt(payload, 1)[1] = 1360771077;

    expect(await rejection(payload)).toEqual({
      message: "City row 1 has a field of the wrong type and was not loaded.",
      code: "rowFieldType",
    });
  });

  it("carries the failing row's index as the detail, not only in the message", async () => {
    const payload = envelope();
    rowsOf(payload)[3] = "Manila, Philippines, 24922000";
    stubDatasetFetch(payload);
    const cities = await freshCities();

    const error = await rejectionOf(cities);

    expect(error.code).toBe("rowShape");
    expect(error.detail).toBe(3);
  });
});

describe("loadCities envelope wiring", () => {
  it("names the city dataset in the messages the shared loader throws", async () => {
    // The shared loader takes the dataset's name for its own six messages, and
    // the row cases above cannot see it being handed the wrong one. The status
    // boundary itself is covered in src/data/loadEnvelope.test.ts; what this
    // case adds is that the name reaching it is this dataset's.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("the city data, honestly", { status: 500 }),
    );
    const cities = await freshCities();

    const error = await rejectionOf(cities);

    expect(error.message).toBe(
      "The city data could not be downloaded (status 500).",
    );
    expect(error.code).toBe("status");
  });
});

describe("loadCities indexing", () => {
  it("derives a lowercase search key and keeps it off the exported city type", async () => {
    stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    const loadCities = await freshLoadCities();

    const rows = await loadCities();
    // A row whose ascii name differs from its name, so the joined key is a
    // claim about four fields rather than about one field repeated.
    const row = rows.find((city) => city.nameAscii !== city.name);
    if (!row) {
      throw new Error(
        "The fixture no longer carries a row whose ascii name differs from its name.",
      );
    }

    expect(row.searchKey).toBe(
      [row.name, row.nameAscii, row.country, row.countryIso3]
        .join(SEARCH_KEY_SEPARATOR)
        .toLowerCase(),
    );

    // The derived key is a search cache rather than a fact about a city, so it
    // stays off the exported type. If it ever appears there, the assignment
    // below stops compiling, which is the only place that can be caught.
    type CityCarriesSearchKey = "searchKey" extends keyof City ? true : false;
    const cityCarriesSearchKey: CityCarriesSearchKey = false;

    expect(cityCarriesSearchKey).toBe(false);
  });

  it("indexes the country code and leaves the capital classification out", async () => {
    stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    const loadCities = await freshLoadCities();

    const rows = await loadCities();
    // A capital, so the row carries a non-empty classification the key could
    // pick up. A row with an empty capital would satisfy the second assertion
    // no matter what the loader joined.
    const tokyo = rows.find((city) => city.name === "Tokyo");
    if (!tokyo) {
      throw new Error("The fixture no longer carries Tokyo.");
    }
    expect(tokyo.capital).toBe("primary");

    expect(tokyo.searchKey).toContain("jpn");
    expect(tokyo.searchKey).not.toContain("primary");
  });
});
