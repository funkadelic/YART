import { describe, it, expect, vi } from "vitest";

import { FILM_FIXTURE_ENVELOPE } from "../test/filmFixture";
import { stubDatasetFetch } from "../test/fetchStub";

/**
 * Guards over the seam alone: what it matches on and what it hands back. The
 * parse boundary behind it is covered in src/data/films/films.test.ts.
 */

/**
 * A cold copy of the seam. The dataset promise is cached in the loader behind
 * it and that cache survives between tests inside one file, so a plain
 * re-import returns an already-populated cache.
 */
async function freshGetFilms() {
  vi.resetModules();
  return (await import("./getFilms")).getFilms;
}

describe("getFilms", () => {
  it("answers every row for an empty term", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    const getFilms = await freshGetFilms();

    const rows = await getFilms();

    expect(rows).toHaveLength(FILM_FIXTURE_ENVELOPE.rows.length);
  });

  it("matches a term against the title regardless of case or padding", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    const getFilms = await freshGetFilms();

    const rows = await getFilms({ searchTerm: "  ANGRY  " });

    expect(rows.map((film) => film.title)).toEqual(["12 Angry Men"]);
  });

  it("answers nothing for a term no title carries", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    const getFilms = await freshGetFilms();

    const rows = await getFilms({ searchTerm: "zzzz" });

    expect(rows).toEqual([]);
  });

  // Identity is what lets the sort cache skip its subset walk on a cleared
  // search; the freeze is what keeps callers from mutating it.
  it("hands back the frozen cached array for the empty term", async () => {
    stubDatasetFetch(FILM_FIXTURE_ENVELOPE);
    vi.resetModules();
    const [{ getFilms }, { loadFilms }] = await Promise.all([
      import("./getFilms"),
      import("../data/films/films"),
    ]);

    const cached = await loadFilms();
    const rows = await getFilms();

    expect(rows).toBe(cached);
    expect(Object.isFrozen(rows)).toBe(true);
  });
});
