import { describe, it, expect } from "vitest";

import type { Film } from "../../api/getFilms";
import { en } from "../../i18n/catalogs/en";
import { collatorFor } from "../../i18n/format";
import { resolveLocale } from "../../i18n/resolveLocale";
import { FILM_FIXTURE } from "../../test/filmFixture";
import { required } from "../../test/required";
import { buildFilmColumns } from "./filmColumns";

/** The tag the base build uses, so the collator here is the one the columns hold. */
const TAG = resolveLocale("en", []).tag;

const COLUMNS = buildFilmColumns(en, TAG);

/** By id rather than by position, so a reordered array does not silently pass. */
function column(id: string) {
  return required(
    COLUMNS.find((candidate) => candidate.id === id),
    `a ${id} column`,
  );
}

/** A row whose fields are stated only where the case under test reads them. */
function film(overrides: Partial<Film>): Film {
  return {
    id: "Q1",
    title: "A Film",
    year: 2000,
    runtime: 100,
    directors: [],
    genres: [],
    countries: [],
    ...overrides,
  };
}

/** The sign is the whole claim: the magnitude of a comparison means nothing. */
function order(id: string, a: Film, b: Film, direction: "asc" | "desc") {
  return Math.sign(column(id).compare(a, b, direction));
}

describe("buildFilmColumns", () => {
  it("builds the six columns the film row type has fields for", () => {
    expect(COLUMNS.map((candidate) => candidate.id)).toEqual([
      "title",
      "year",
      "runtime",
      "directors",
      "genres",
      "countries",
    ]);
  });

  // The flag is presentational only: it buys end alignment and tabular figures.
  // A multi-valued column is text and keeps the start alignment that follows
  // the reading direction.
  it("marks the two numeric columns and leaves the multi-valued ones alone", () => {
    const numeric = COLUMNS.filter((candidate) => candidate.numeric);

    expect(numeric.map((candidate) => candidate.id)).toEqual([
      "year",
      "runtime",
    ]);
  });
});

describe("the multi-valued cells", () => {
  it("joins the values through the catalog rather than a separator of its own", () => {
    const values = ["France", "Italy", "Spain"];
    const row = film({ countries: values });

    expect(column("countries").renderCell(row)).toBe(
      en.common.list(TAG, values),
    );
  });

  it("paints an empty cell for a film with no recorded genre", () => {
    expect(column("genres").renderCell(film({ genres: [] }))).toBe("");
  });
});

describe("the genres comparator", () => {
  const two = film({ genres: ["drama film", "comedy film"] });
  const three = film({ genres: ["drama film", "comedy film", "war film"] });
  const none = film({ genres: [] });

  it("orders the shorter list first ascending and the longer first descending", () => {
    expect(order("genres", two, three, "asc")).toBe(-1);
    expect(order("genres", two, three, "desc")).toBe(1);
  });

  it("falls through to a collated comparison when the lengths agree", () => {
    const collator = collatorFor(TAG);
    const other = film({ genres: ["action film", "comedy film"] });

    const collated = Math.sign(collator.compare("drama film", "action film"));

    expect(order("genres", two, other, "asc")).toBe(collated);
    expect(order("genres", two, other, "desc")).toBe(-collated);
  });

  // The case the default comparator gets wrong: an empty array is not blank by
  // the shared definition, so it would sort among the letters rather than last.
  it("sorts a film with no recorded genre last in both directions", () => {
    expect(order("genres", none, two, "asc")).toBe(1);
    expect(order("genres", none, two, "desc")).toBe(1);
    expect(order("genres", two, none, "asc")).toBe(-1);
    expect(order("genres", two, none, "desc")).toBe(-1);
  });

  // Identity rather than equality: negated zero is equal to zero and is not the
  // same value, and it is the difference an equality check downstream reads.
  it("returns positive zero for two films with no recorded genre", () => {
    expect(Object.is(column("genres").compare(none, none, "desc"), 0)).toBe(
      true,
    );
  });

  it("returns positive zero for two films with the same genres", () => {
    const same = film({ genres: [...two.genres] });

    expect(Object.is(column("genres").compare(two, same, "desc"), 0)).toBe(
      true,
    );
  });
});

describe("the collated ordering", () => {
  // Two real titles whose collated order is not their code-unit order: the
  // ligature collates as the two letters it joins and sorts above the point its
  // single code unit would put it.
  const LIGATURE = required(
    FILM_FIXTURE.find((candidate) => candidate.title.startsWith("Æ")),
    "a fixture title beginning with a ligature",
  );
  const PLAIN = required(
    FILM_FIXTURE.find((candidate) => candidate.title === "Avatar"),
    "the fixture title Avatar",
  );

  it("orders titles the way the collator does rather than by code unit", () => {
    const collator = collatorFor(TAG);
    const collated = Math.sign(collator.compare(LIGATURE.title, PLAIN.title));

    expect(order("title", LIGATURE, PLAIN, "asc")).toBe(collated);
    expect(collated).not.toBe(Math.sign(LIGATURE.title < PLAIN.title ? -1 : 1));
  });
});

describe("the two numeric columns", () => {
  const YEARS = FILM_FIXTURE.map((candidate) => candidate.year).filter(
    (year): year is number => year !== null,
  );
  const EARLIEST = Math.min(...YEARS);
  const LATEST = Math.max(...YEARS);

  it("sorts a film with no recorded year last in both directions", () => {
    const absent = film({ year: null });
    const present = film({ year: EARLIEST });

    expect(order("year", absent, present, "asc")).toBe(1);
    expect(order("year", absent, present, "desc")).toBe(1);
  });

  it("sorts a film with no recorded runtime last in both directions", () => {
    const absent = film({ runtime: null });
    const present = film({ runtime: 1 });

    expect(order("runtime", absent, present, "asc")).toBe(1);
    expect(order("runtime", absent, present, "desc")).toBe(1);
  });

  it("orders the earliest and the latest year against their neighbors", () => {
    expect(
      order(
        "year",
        film({ year: EARLIEST }),
        film({ year: EARLIEST + 1 }),
        "asc",
      ),
    ).toBe(-1);
    expect(
      order("year", film({ year: LATEST }), film({ year: LATEST - 1 }), "asc"),
    ).toBe(1);
    expect(
      order("year", film({ year: EARLIEST }), film({ year: LATEST }), "asc"),
    ).toBe(-1);
  });

  // Kept as it was published rather than rounded, so it has to compare as the
  // fraction it is rather than as either integer beside it.
  it("orders a fractional runtime between the two integers it lies between", () => {
    const fractional = required(
      FILM_FIXTURE.find(
        (candidate) =>
          candidate.runtime !== null && !Number.isInteger(candidate.runtime),
      ),
      "a fixture row with a fractional runtime",
    );
    const minutes = required(fractional.runtime ?? undefined, "its runtime");

    expect(
      order(
        "runtime",
        film({ runtime: Math.floor(minutes) }),
        fractional,
        "asc",
      ),
    ).toBe(-1);
    expect(
      order(
        "runtime",
        fractional,
        film({ runtime: Math.ceil(minutes) }),
        "asc",
      ),
    ).toBe(-1);
  });
});
