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
 * The per-field matcher the derived search key replaced, over the same fields
 * the key is built from. The parity cases compare the seam against this rather
 * than against a recorded count, so a divergence of the same size but different
 * membership still fails. Capital is absent here because it is absent from the
 * key, so a loader that started folding it in would break parity rather than
 * pass quietly.
 */
function matchedBefore(city: City, searchTerm: string): boolean {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return true;
  return [city.name, city.nameAscii, city.country, city.countryIso3].some(
    (field) => field.toLowerCase().includes(needle),
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

    // Matching is a substring search across name, ascii name, country, and
    // country code, so a result need not be in Japan: "Pajapan, Mexico" matches
    // on its name.
    expect(
      result.every((city) =>
        [city.name, city.nameAscii, city.country, city.countryIso3].some(
          (field) => field.toLowerCase().includes("japan"),
        ),
      ),
    ).toBe(true);
  });

  it("matches on country code", async () => {
    const result = await getCities({ searchTerm: "jpn" });

    // The term returned nothing at all before the code was indexed, which is
    // what made a shared "?q=jpn" link paint an empty table for its recipient.
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((city) => city.countryIso3 === "JPN")).toBe(true);
  });

  it("does not match on the capital classification", async () => {
    // Deliberate, not an oversight: the column renders "primary", "admin", and
    // "minor", and indexing them would bleed those substrings into every short
    // needle. The loader's key comment carries the measurement.
    expect(await getCities({ searchTerm: "primary" })).toHaveLength(0);
    expect(await getCities({ searchTerm: "admin" })).toHaveLength(0);
  });

  it("returns an empty list when nothing matches", async () => {
    const result = await getCities({ searchTerm: "zzzzzzzz" });
    expect(result).toHaveLength(0);
  });

  it("rejects with copy written for a reader when the request never reaches the host", async () => {
    const failure = new Error("The connection was refused");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(failure);

    const coldGetCities = await freshGetCities();

    // The injected text does not reach the seam: the loader replaces a
    // transport failure with copy a reader can act on and keeps the original as
    // the cause, which is asserted where the wrap lives rather than here. The
    // same holds for every load-failure assertion below.
    await expect(coldGetCities()).rejects.toThrow(
      "The city data could not be downloaded. Check your connection and try again.",
    );
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
    expect(tokyoRows).not.toHaveLength(japanRows.length);
    expect(tokyoRows.every((city) => matchedBefore(city, "tokyo"))).toBe(true);
    expect(japanRows.every((city) => matchedBefore(city, "japan"))).toBe(true);
  });

  it("issues a second request when the first load failed", async () => {
    const failure = new Error("The connection was refused");
    fetchSpy.mockRejectedValueOnce(failure);

    const coldGetCities = await freshGetCities();

    await expect(coldGetCities()).rejects.toThrow(
      "The city data could not be downloaded. Check your connection and try again.",
    );

    const recovered = await coldGetCities();

    expect(recovered.length).toBeGreaterThanOrEqual(50000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("issues one request for two callers that share a failed load, and one more for the retry", async () => {
    const failure = new Error("The connection dropped");
    fetchSpy.mockRejectedValue(failure);

    const coldGetCities = await freshGetCities();

    // Both callers land on the one in-flight load, so what they see is a single
    // request failing once rather than two failures.
    const first = coldGetCities();
    const second = coldGetCities();

    await expect(first).rejects.toThrow(
      "The city data could not be downloaded. Check your connection and try again.",
    );
    await expect(second).rejects.toThrow(
      "The city data could not be downloaded. Check your connection and try again.",
    );

    // The retry is the second request. The shared rejection cleared the cache
    // entry, so the next call downloads again rather than re-awaiting a promise
    // that has already failed.
    await expect(coldGetCities()).rejects.toThrow(
      "The city data could not be downloaded. Check your connection and try again.",
    );

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
describe("getCities result ownership", () => {
  it("hands back an array the caller owns rather than the cached one", async () => {
    // The copy on the empty-term branch has no other observable consequence,
    // so without an identity assertion a later refactor can hand the
    // module-scope cache straight to callers again and nothing goes red.
    vi.resetModules();
    const [{ getCities: coldGetCities }, { loadCities }] = await Promise.all([
      import("./getCities"),
      import("../data/worldcities/cities"),
    ]);

    // Both imports come from the one registry reset above, so the array the
    // loader caches is the array the seam would otherwise return.
    const cached = await loadCities();
    const first = await coldGetCities({ searchTerm: "" });
    const second = await coldGetCities({ searchTerm: "" });

    expect(first).not.toBe(cached);
    expect(second).not.toBe(cached);
    expect(first).not.toBe(second);
  });
});
