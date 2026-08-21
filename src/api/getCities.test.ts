import { describe, it, expect, beforeEach, vi } from "vitest";

import { getCities } from "./getCities";
import {
  readCommittedAsset,
  stubDatasetFetchFromDisk,
} from "../test/fetchStub";

// The committed asset is read once and served verbatim through the stubbed
// request, so the real data quirks stay in play. The country case below is one
// of them and would stop meaning anything against a hand-written fixture.
const COMMITTED_ASSET = readCommittedAsset();

/**
 * A cold copy of the seam. The dataset promise is cached at module scope and
 * that cache survives between tests inside one file, so a plain re-import
 * returns a populated cache and issues no request at all.
 */
async function freshGetCities() {
  vi.resetModules();
  return (await import("./getCities")).getCities;
}

describe("getCities", () => {
  beforeEach(() => {
    stubDatasetFetchFromDisk(COMMITTED_ASSET);
  });

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
