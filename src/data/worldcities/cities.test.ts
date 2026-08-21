import { describe, it, expect, vi } from "vitest";

import type { City } from "../../api/getCities";
import { CITY_FIXTURE_ENVELOPE } from "../../test/cityFixture";
import { stubDatasetFetch } from "../../test/fetchStub";

/**
 * Guards over the parse boundary, which is the only runtime type check the
 * dataset still has now that it arrives over the network instead of through the
 * compiler. Without a case per rejection path, a malformed asset does not fail
 * loudly: it fills the table with undefined cells and surfaces much later as a
 * cryptic sort crash, at which point nothing points back here.
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
 * A cold copy of the loader. The dataset promise is cached at module scope and
 * that cache survives between tests inside one file, so a plain re-import
 * returns an already-populated cache and never reaches the parse boundary at
 * all.
 */
async function freshLoadCities() {
  vi.resetModules();
  return (await import("./cities")).loadCities;
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

function columnsOf(payload: Envelope): unknown[] {
  return payload.columns as unknown[];
}

function rowAt(payload: Envelope, at: number): unknown[] {
  return rowsOf(payload)[at] as unknown[];
}

/**
 * The message a load rejected with. Resolving is itself a failure here, and it
 * is reported as one rather than left to a later assertion on an undefined
 * value.
 */
async function rejectionMessage(payload: unknown): Promise<string> {
  stubDatasetFetch(payload);
  const loadCities = await freshLoadCities();

  try {
    await loadCities();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error("The load resolved when it was expected to reject.");
}

/**
 * The error a load rejected with, for the cases that assert more than a message.
 * Resolving is itself a failure here, and it is reported as one rather than left
 * to a later assertion on an undefined value.
 */
async function rejectionOf(load: () => Promise<unknown>): Promise<Error> {
  try {
    await load();
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error(`The load rejected with a non-error: ${String(error)}`);
  }

  throw new Error("The load resolved when it was expected to reject.");
}

describe("loadCities payload validation", () => {
  it("rejects a payload that is not an object", async () => {
    expect(await rejectionMessage("the city data, honestly")).toBe(
      "The city data could not be read.",
    );
  });

  it("rejects a null payload", async () => {
    expect(await rejectionMessage(null)).toBe(
      "The city data could not be read.",
    );
  });

  it("rejects a payload with no rows array", async () => {
    const payload = envelope();
    delete (payload as Partial<Envelope>).rows;

    expect(await rejectionMessage(payload)).toBe(
      "The city data is missing its rows array.",
    );
  });

  it("rejects a payload whose rows is an object rather than an array", async () => {
    const payload = envelope();
    payload.rows = { 0: rowAt(envelope(), 0) };

    expect(await rejectionMessage(payload)).toBe(
      "The city data is missing its rows array.",
    );
  });

  it("rejects a payload with no columns array", async () => {
    const payload = envelope();
    delete (payload as Partial<Envelope>).columns;

    expect(await rejectionMessage(payload)).toBe(
      "The city data has an unexpected column order and was not loaded.",
    );
  });

  it("rejects a payload whose columns are transposed", async () => {
    const payload = envelope();
    const columns = columnsOf(payload);
    [columns[1], columns[2]] = [columns[2], columns[1]];

    expect(await rejectionMessage(payload)).toBe(
      "The city data has an unexpected column order and was not loaded.",
    );
  });

  it("rejects a payload whose columns are short by one", async () => {
    const payload = envelope();
    payload.columns = columnsOf(payload).slice(0, 6);

    expect(await rejectionMessage(payload)).toBe(
      "The city data has an unexpected column order and was not loaded.",
    );
  });

  it("rejects a row that is not an array, naming its index", async () => {
    const payload = envelope();
    rowsOf(payload)[3] = "Manila, Philippines, 24922000";

    expect(await rejectionMessage(payload)).toBe(
      "City row 3 does not have 7 fields and was not loaded.",
    );
  });

  it("rejects a row with one field too few, naming its index", async () => {
    const payload = envelope();
    rowsOf(payload)[2] = rowAt(payload, 2).slice(0, 6);

    expect(await rejectionMessage(payload)).toBe(
      "City row 2 does not have 7 fields and was not loaded.",
    );
  });

  it("rejects a row with one field too many, naming its index", async () => {
    const payload = envelope();
    rowsOf(payload)[4] = [...rowAt(payload, 4), "admin"];

    expect(await rejectionMessage(payload)).toBe(
      "City row 4 does not have 7 fields and was not loaded.",
    );
  });

  it("rejects a row whose id is the string form of its number", async () => {
    const payload = envelope();
    rowAt(payload, 5)[0] = String(rowAt(payload, 5)[0]);

    expect(await rejectionMessage(payload)).toBe(
      "City row 5 has a field of the wrong type and was not loaded.",
    );
  });

  it("rejects a row whose population is null", async () => {
    const payload = envelope();
    rowAt(payload, 6)[6] = null;

    expect(await rejectionMessage(payload)).toBe(
      "City row 6 has a field of the wrong type and was not loaded.",
    );
  });

  it("rejects a row whose name is a number", async () => {
    const payload = envelope();
    rowAt(payload, 1)[1] = 1360771077;

    expect(await rejectionMessage(payload)).toBe(
      "City row 1 has a field of the wrong type and was not loaded.",
    );
  });
});

describe("loadCities transport", () => {
  it("rejects a non-ok response by status, without reading the body", async () => {
    // The body served here would fail validation on its own, so a message that
    // names the status is proof the status was checked before anything was
    // parsed.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("the city data, honestly", { status: 500 }),
    );
    const loadCities = await freshLoadCities();

    let message = "";
    try {
      await loadCities();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe("The city data could not be downloaded (status 500).");
  });

  it("rejects a request that never reaches the host with copy written for a reader", async () => {
    // The text a failed request carries is the browser's own, it differs
    // between browsers, and none of it tells the reader what to do. The
    // authored message is written here as a literal rather than imported from
    // the loader, so a rename cannot move both sides at once.
    const transportFailure = new Error("Failed to fetch");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(transportFailure);
    const loadCities = await freshLoadCities();

    const error = await rejectionOf(loadCities);

    expect(error.message).toBe(
      "The city data could not be downloaded. Check your connection and try again.",
    );
    expect(error.message).not.toContain("Failed to fetch");
    // The reader sees the authored sentence, a developer still has the reason.
    expect(error.cause).toBe(transportFailure);
  });

  it("rejects a success response carrying a page instead of the data file", async () => {
    // What a static host returns for a file it cannot find: the application's
    // own page, under a success status. The parser then reports a syntax error
    // naming a character, which is no help to anyone reading the screen.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        "<!doctype html><html><body>Yet Another React Table</body></html>",
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    );
    const loadCities = await freshLoadCities();

    const error = await rejectionOf(loadCities);

    expect(error.message).toBe(
      "The city data was downloaded but could not be read as JSON.",
    );
    expect(error.message).not.toContain("Unexpected token");
    expect(error.cause).toBeInstanceOf(Error);
  });
});

describe("loadCities indexing", () => {
  it("derives a lowercase search key and keeps it off the exported city type", async () => {
    stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    const loadCities = await freshLoadCities();

    const rows = await loadCities();
    // A row whose ascii name differs from its name, so the joined key is a
    // claim about three fields rather than about one field repeated.
    const row = rows.find((city) => city.nameAscii !== city.name);
    if (!row) {
      throw new Error(
        "The fixture no longer carries a row whose ascii name differs from its name.",
      );
    }

    expect(row.searchKey).toBe(
      [row.name, row.nameAscii, row.country]
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
});
