import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { getCities } from "./getCities";
import type { City } from "./getCities";
import {
  readCommittedAsset,
  stubDatasetFetchFromDisk,
} from "../test/fetchStub";

// The committed asset is read once and served verbatim through the stubbed
// request, so the real data quirks stay in play. The country case below is one
// of them and would stop meaning anything against a hand-written fixture.
const COMMITTED_ASSET = readCommittedAsset();

/**
 * The dataset request stub installed for the current case. Held here because
 * the load-once claim can only be stated as a call count: a timing observation
 * passes against a second request that happened to be fast.
 */
let fetchSpy: ReturnType<typeof stubDatasetFetchFromDisk>;

/**
 * A cold copy of the seam. The dataset promise is cached at module scope and
 * that cache survives between tests inside one file, so a plain re-import
 * returns an already-populated cache and issues no request at all. Every case
 * that asserts a request count starts here, or it is counting what an earlier
 * case already loaded.
 */
async function freshGetCities() {
  vi.resetModules();
  return (await import("./getCities")).getCities;
}

/**
 * The per-field matcher the derived search key replaced, reproduced exactly.
 * The parity cases compare the seam against this rather than against a recorded
 * count, so a divergence of the same size but different membership still fails.
 */
function matchedBefore(city: City, searchTerm: string): boolean {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return true;
  return [city.name, city.nameAscii, city.country].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

/**
 * Needles a space-separated search key would answer differently. The first six
 * span a field boundary, which is the divergence itself, and the last three are
 * the multi-word and padded terms a separator is easiest to get wrong on. This
 * group is a correctness test of the separator, not a performance test of the
 * derived key.
 */
const PARITY_NEEDLES = [
  "a b",
  "e s",
  "o j",
  "york united",
  "tokyo japan",
  "paris fra",
  "new york",
  "united states",
  "  Paris  ",
];

/**
 * A string that appears in none of the chosen row's seven field values. It is
 * lowercase because the needle is lowercased before comparison and the key is
 * stored lowercased, so an uppercase sentinel would never match and the case
 * would pass for the wrong reason.
 */
const SEARCH_KEY_SENTINEL = "qqderivedkeysentinelqq";

let everyRow: City[] | undefined;

/**
 * The whole row set, loaded once through this file's warm module instance.
 * Every parity case filters this same array, so a difference can only come from
 * the matching and never from the input.
 */
async function allRows(): Promise<City[]> {
  everyRow ??= await getCities({ searchTerm: "" });
  return everyRow;
}

beforeEach(() => {
  fetchSpy = stubDatasetFetchFromDisk(COMMITTED_ASSET);
});

afterEach(() => {
  // A case that leaves the clock frozen leaks it into whatever runs next.
  vi.useRealTimers();
});

describe("getCities", () => {
  it("returns every city when the search term is empty", async () => {
    const result = await getCities({ searchTerm: "" });
    expect(result.length).toBeGreaterThan(0);
  });

  it("matches on city name", async () => {
    const result = await getCities({ searchTerm: "tokyo" });
    expect(result.map((city) => city.name)).toContain("Tokyo");
  });

  it("matches on country name", async () => {
    const result = await getCities({ searchTerm: "japan" });

    expect(result.some((city) => city.country === "Japan")).toBe(true);

    // Matching is a substring search across name, ascii name, and country, so
    // a result need not be in Japan: "Pajapan, Mexico" matches on its name.
    expect(
      result.every((city) =>
        [city.name, city.nameAscii, city.country].some((field) =>
          field.toLowerCase().includes("japan"),
        ),
      ),
    ).toBe(true);
  });

  it("returns an empty list when nothing matches", async () => {
    const result = await getCities({ searchTerm: "zzzzzzzz" });
    expect(result).toHaveLength(0);
  });

  it("rejects with the underlying failure when the request rejects", async () => {
    const failure = new Error("The connection was refused");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(failure);

    const coldGetCities = await freshGetCities();

    await expect(coldGetCities()).rejects.toThrow(failure.message);
  });

  it("rejects with a message naming the status when the response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404 }),
    );

    const coldGetCities = await freshGetCities();

    await expect(coldGetCities()).rejects.toThrow(
      "The city data could not be downloaded (status 404).",
    );
  });
});

describe("getCities dataset requests", () => {
  it("issues one request across two searches with different terms", async () => {
    const coldGetCities = await freshGetCities();

    await coldGetCities({ searchTerm: "tokyo" });
    await coldGetCities({ searchTerm: "japan" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("issues one request for two searches started before the first load settles", async () => {
    const coldGetCities = await freshGetCities();

    const tokyo = coldGetCities({ searchTerm: "tokyo" });
    const japan = coldGetCities({ searchTerm: "japan" });
    const [tokyoRows, japanRows] = await Promise.all([tokyo, japan]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Sharing one in-flight load must not collapse the two calls into one
    // answer: each still filters the shared rows for its own term.
    expect(tokyoRows.length).not.toBe(japanRows.length);
    expect(tokyoRows.every((city) => matchedBefore(city, "tokyo"))).toBe(true);
    expect(japanRows.every((city) => matchedBefore(city, "japan"))).toBe(true);
  });

  it("issues a second request when the first load failed", async () => {
    const failure = new Error("The connection was refused");
    fetchSpy.mockRejectedValueOnce(failure);

    const coldGetCities = await freshGetCities();

    await expect(coldGetCities()).rejects.toThrow(failure.message);

    const recovered = await coldGetCities();

    expect(recovered.length).toBeGreaterThanOrEqual(50000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("costs two requests, not three, when two callers share a failed load and one retries", async () => {
    const failure = new Error("The connection dropped");
    fetchSpy.mockRejectedValue(failure);

    const coldGetCities = await freshGetCities();

    // Both callers land on the one in-flight load, so what they see is a single
    // request failing once rather than two failures.
    const first = coldGetCities();
    const second = coldGetCities();

    await expect(first).rejects.toThrow(failure.message);
    await expect(second).rejects.toThrow(failure.message);

    // The retry is the second request. A rejection that cleared a cache entry
    // it no longer owned would make the next call a third.
    await expect(coldGetCities()).rejects.toThrow(failure.message);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("getCities latency", () => {
  it("still takes the simulated latency when the dataset is already cached", async () => {
    const coldGetCities = await freshGetCities();
    await coldGetCities({ searchTerm: "tokyo" });

    vi.useFakeTimers();

    let settled = false;
    const inFlight = coldGetCities({ searchTerm: "japan" }).then(() => {
      settled = true;
    });

    // Let the already-resolved loader hand back its rows so the latency timer
    // is registered before the clock moves. An implementation that resolved in
    // a microtask instead would be settled here, at zero milliseconds, which is
    // exactly what this case rules out.
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(199);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);

    await inFlight;
  });
});

describe("getCities search parity", () => {
  it.each(PARITY_NEEDLES)(
    'returns exactly what the per-field matcher returned for "%s"',
    async (needle) => {
      const rows = await allRows();
      const expected = rows
        .filter((city) => matchedBefore(city, needle))
        .map((city) => city.id);

      const actual = (await getCities({ searchTerm: needle })).map(
        (city) => city.id,
      );

      expect(actual).toEqual(expected);
    },
  );

  it("returns every row for an empty term", async () => {
    const rows = await allRows();
    const result = await getCities({ searchTerm: "" });

    expect(result).toHaveLength(rows.length);
  });

  it("returns every row for a whitespace-only term", async () => {
    const rows = await allRows();
    const result = await getCities({ searchTerm: "   " });

    expect(result).toHaveLength(rows.length);
  });

  it("filters on the derived search key and on nothing else", async () => {
    // Every case above compares the seam against a matcher that lowercases the
    // three fields per call, so a seam that ignored the derived key and did the
    // same would satisfy all of them and the key would be dead weight. This is
    // the case that fails when the key stops being read.
    vi.resetModules();
    const [{ getCities: coldGetCities }, { loadCities }] = await Promise.all([
      import("./getCities"),
      import("../data/worldcities/cities"),
    ]);

    // Both imports come from the one registry reset above, so the seam and the
    // loader share a cache and the rows mutated here are the rows it filters.
    // The key is reachable through the loader's resolved element type and
    // deliberately absent from the exported domain type, which is the whole
    // reason it has to be reached this way.
    const rows = await loadCities();
    const target = rows[0];
    const ownName = target.name;
    target.searchKey = SEARCH_KEY_SENTINEL;

    const bySentinel = await coldGetCities({
      searchTerm: SEARCH_KEY_SENTINEL,
    });
    const byOwnName = await coldGetCities({ searchTerm: ownName });

    expect(bySentinel.map((city) => city.id)).toContain(target.id);
    expect(byOwnName.map((city) => city.id)).not.toContain(target.id);
  });
});
