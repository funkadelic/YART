import { afterEach, describe, it, expect, vi } from "vitest";

import { FILM_FIXTURE_ENVELOPE } from "../test/filmFixture";
import { stubDatasetFetch } from "../test/fetchStub";

/**
 * Guards over the seam alone: what it matches on, what it hands back, and that
 * it still costs what a network call costs. The parse boundary behind it is
 * covered in src/data/films/films.test.ts.
 */

/**
 * The latency the seam simulates on every call, download or not. Written out
 * here rather than imported, because a test that reached in for the constant
 * would pass for any delay at all, including none.
 */
const LATENCY_MS = 200;

/**
 * A cold copy of the seam. The dataset promise is cached in the loader behind
 * it and that cache survives between tests inside one file, so a plain
 * re-import returns an already-populated cache.
 */
async function freshGetFilms() {
  vi.resetModules();
  return (await import("./getFilms")).getFilms;
}

afterEach(() => {
  vi.useRealTimers();
});

/** Resolves the seam's promise by advancing past the delay it schedules. */
async function settle<T>(pending: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(LATENCY_MS);
  return await pending;
}

describe("getFilms", () => {
  it("answers every row for an empty term", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    vi.useFakeTimers();
    const getFilms = await freshGetFilms();

    const rows = await settle(getFilms());

    expect(rows).toHaveLength(FILM_FIXTURE_ENVELOPE.rows.length);
  });

  it("matches a term against the title regardless of case", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    vi.useFakeTimers();
    const getFilms = await freshGetFilms();

    const rows = await settle(getFilms({ searchTerm: "ANGRY" }));

    expect(rows.map((film) => film.title)).toEqual(["12 Angry Men"]);
  });

  it("answers nothing for a term no title carries", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    vi.useFakeTimers();
    const getFilms = await freshGetFilms();

    const rows = await settle(getFilms({ searchTerm: "zzzz" }));

    expect(rows).toEqual([]);
  });

  // The cached array is shared by every caller, so handing it out would let one
  // caller's sort reorder another's rows.
  it("hands back a copy rather than the cached array", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    vi.useFakeTimers();
    const getFilms = await freshGetFilms();

    const first = await settle(getFilms());
    const second = await settle(getFilms());

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  // Applied to the filter as well as the download, so a cache-warm call still
  // behaves like a network call and the debounce timing keeps its meaning.
  it("stays unsettled until the simulated latency has elapsed", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    vi.useFakeTimers();
    const getFilms = await freshGetFilms();

    // Warm the cache, so the only delay left on the second call is the seam's.
    await settle(getFilms());

    let settled = false;
    const pending = getFilms({ searchTerm: "angry" }).then((rows) => {
      settled = true;
      return rows;
    });

    await vi.advanceTimersByTimeAsync(LATENCY_MS - 1);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toBe(true);
  });
});
