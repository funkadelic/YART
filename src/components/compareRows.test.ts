import { describe, expect, it } from "vitest";

import type { City } from "../api/getCities";
import { cityRowId } from "../features/CityTable/cityColumns";
import { CITY_FIXTURE } from "../test/cityFixture";
import { required } from "../test/required";
import { collatorFor } from "../i18n/format";
import { compareIdentities } from "./DataTable/sortRows";
import { compareValues } from "./compareRows";

/**
 * The collator every case below that does not name a locale orders text with.
 * It names the base tag, because the comparator holds none of its own and every
 * caller now states which reader's ordering it is asking about; a test is a
 * caller like any other.
 */
const EN = collatorFor("en-US");

/**
 * A pair whose order genuinely depends on the collator's tag. Spanish treats
 * the tilde as its own letter, so it sorts after every plain n; the root
 * collation English and French inherit treats it as a variant of n and decides
 * the pair on the following character instead.
 */
const TILDE = "ñu";
const PLAIN = "nz";

const BLANK_CAPITAL = CITY_FIXTURE.filter((city) => city.capital === "");
const PRIMARY_CAPITAL = CITY_FIXTURE.filter(
  (city) => city.capital === "primary",
);
const ZERO_POPULATION = CITY_FIXTURE.filter((city) => city.population === 0);
// Picked once here, so the cases below read as the comparison they are testing.
// The first case in the block asserts the counts these three depend on.
const BLANK = required(BLANK_CAPITAL[0], "a fixture row with a blank capital");
const PRIMARY = required(
  PRIMARY_CAPITAL[0],
  "a fixture row with a primary capital",
);
const ZERO = required(ZERO_POPULATION[0], "a fixture row with no population");
const FIRST_CITY = required(CITY_FIXTURE[0], "the first fixture row");
const LARGEST_POPULATION = CITY_FIXTURE.reduce((largest, city) =>
  city.population > largest.population ? city : largest,
);

/**
 * Mixed-case, accented, and number-like strings, which is where a collation
 * change would show up first if one were ever made by accident.
 */
const COLLATION_SAMPLE = ["a", "B", "ä", "Z", "é", "10", "2"];

/**
 * A row the parse boundary would reject. City declares no nullable field and no
 * field that is sometimes text and sometimes a number, so a correctly typed city
 * reaches neither the comparator's null arm nor its mixed-type arm. The film row
 * type does reach the null arm, through its two nullable number fields; the
 * mixed-type arm no row type in the tree reaches, and this is the single place
 * that hands the comparator what such input looks like.
 */
function rowWithCapital(id: number, capital: unknown): City {
  return { ...CITY_FIXTURE[0], id, capital } as City;
}

/**
 * The comparator no longer sees a row, so the identity tiebreak it used to
 * apply is applied here instead. Both halves are the shipping functions, since a
 * local restatement of them would pass while the product ordered rows
 * differently. Every expected order below is the order the application produces.
 */
function byColumn(column: keyof City, direction: "asc" | "desc") {
  return (a: City, b: City): number => {
    const comparison = compareValues(a[column], b[column], direction, EN);
    return comparison !== 0
      ? comparison
      : compareIdentities(cityRowId(a), cityRowId(b));
  };
}

function sortedIds(
  rows: City[],
  column: keyof City,
  direction: "asc" | "desc",
): number[] {
  return [...rows].sort(byColumn(column, direction)).map((row) => row.id);
}

describe("compareValues", () => {
  it("has a fixture that still carries the rows these cases need", () => {
    expect(BLANK_CAPITAL.length).toBeGreaterThanOrEqual(2);
    expect(PRIMARY_CAPITAL.length).toBeGreaterThanOrEqual(2);
    expect(ZERO_POPULATION.length).toBeGreaterThanOrEqual(1);
  });

  it("orders a blank value last when sorting ascending", () => {
    expect(
      compareValues(BLANK.capital, PRIMARY.capital, "asc", EN),
    ).toBeGreaterThan(0);
    expect(
      compareValues(PRIMARY.capital, BLANK.capital, "asc", EN),
    ).toBeLessThan(0);
  });

  it("orders a blank value last when sorting descending as well", () => {
    expect(
      compareValues(BLANK.capital, PRIMARY.capital, "desc", EN),
    ).toBeGreaterThan(0);
    expect(
      compareValues(PRIMARY.capital, BLANK.capital, "desc", EN),
    ).toBeLessThan(0);
  });

  it("reports two blank values as equal in both directions", () => {
    // The pair used to come back separated by the row-id difference. Identity
    // is not a value, so the ordering half of this case now lives beside the
    // sort module and only the value-level fact it rested on stays here.
    const first = required(BLANK_CAPITAL[0], "the first blank-capital row");
    const second = required(BLANK_CAPITAL[1], "the second blank-capital row");

    expect(compareValues(first.capital, second.capital, "asc", EN)).toBe(0);
    expect(compareValues(first.capital, second.capital, "desc", EN)).toBe(0);
  });

  it("treats a zero as the smallest number rather than as a blank", () => {
    expect(
      compareValues(ZERO.population, LARGEST_POPULATION.population, "asc", EN),
    ).toBeLessThan(0);
    expect(
      compareValues(ZERO.population, LARGEST_POPULATION.population, "desc", EN),
    ).toBeGreaterThan(0);
  });

  it("reports two equal values as equal in both directions", () => {
    const first = required(PRIMARY_CAPITAL[0], "the first primary-capital row");
    const second = required(
      PRIMARY_CAPITAL[1],
      "the second primary-capital row",
    );

    expect(compareValues(first.capital, second.capital, "asc", EN)).toBe(0);
    expect(compareValues(first.capital, second.capital, "desc", EN)).toBe(0);
  });

  it("gives a string paired with a number a defined order", () => {
    const forward = compareValues("primary", 42, "asc", EN);
    const backward = compareValues(42, "primary", "asc", EN);

    expect(forward).not.toBe(0);
    expect(Math.sign(backward)).toBe(-Math.sign(forward));
  });

  it("orders a mixed-type column without a cycle", () => {
    // Deciding a numeric pair by subtraction and a stringified pair by
    // collation is enough to produce 9 < 10 < "5" < 9, which the sort is free
    // to resolve however it likes. Ranking by type first rules that out.
    const nine = rowWithCapital(1, 9);
    const ten = rowWithCapital(2, 10);
    const five = rowWithCapital(3, "5");
    const rows = [nine, ten, five];

    for (const pair of [
      [nine, ten],
      [ten, five],
      [nine, five],
    ] as const) {
      const forward = compareValues(
        pair[0].capital,
        pair[1].capital,
        "asc",
        EN,
      );
      const backward = compareValues(
        pair[1].capital,
        pair[0].capital,
        "asc",
        EN,
      );
      expect(Math.sign(backward)).toBe(-Math.sign(forward));
    }

    // Transitive: the two numbers order among themselves and both land ahead
    // of the text, whichever order the rows arrive in.
    const expected = [1, 2, 3];
    expect(sortedIds(rows, "capital", "asc")).toEqual(expected);
    expect(sortedIds([five, nine, ten], "capital", "asc")).toEqual(expected);
    expect(sortedIds([ten, five, nine], "capital", "asc")).toEqual(expected);
  });

  it("ranks a non-primitive after every number and every string", () => {
    // The third rank. Without a case here the transitivity claim is checked
    // over two of the three groups the comparator declares.
    const number = rowWithCapital(1, 9);
    const text = rowWithCapital(2, "primary");
    const object = rowWithCapital(3, { toString: () => "zzz" });

    expect(sortedIds([object, text, number], "capital", "asc")).toEqual([
      1, 2, 3,
    ]);
    expect(sortedIds([text, object, number], "capital", "asc")).toEqual([
      1, 2, 3,
    ]);
    expect(sortedIds([number, object, text], "capital", "asc")).toEqual([
      1, 2, 3,
    ]);
  });

  it("orders a non-finite number as blank rather than returning NaN", () => {
    // NaN is a number by typeof, so it reaches the subtraction and comes back
    // NaN: neither negative, positive, nor zero. The direction flip leaves it
    // NaN, the row-id tiebreak never runs, and the sort resolves it however it
    // likes, which showed up as three orders for three arrival orders.
    const notANumber = rowWithCapital(1, NaN);
    const small = rowWithCapital(2, 5);
    const large = rowWithCapital(3, 10);
    const rows = [notANumber, small, large];

    expect(
      compareValues(notANumber.capital, small.capital, "asc", EN),
    ).toBeGreaterThan(0);
    expect(
      compareValues(notANumber.capital, small.capital, "desc", EN),
    ).toBeGreaterThan(0);

    // Blank last, both directions, and the same order whichever way the rows
    // arrive.
    expect(sortedIds(rows, "capital", "asc")).toEqual([2, 3, 1]);
    expect(sortedIds([large, notANumber, small], "capital", "asc")).toEqual([
      2, 3, 1,
    ]);
    expect(sortedIds([small, large, notANumber], "capital", "asc")).toEqual([
      2, 3, 1,
    ]);
  });

  it("reports two infinities of the same sign as equal rather than NaN", () => {
    // Subtracting them gives NaN, which is neither negative, positive, nor
    // zero, so a tiebreak downstream of this function would never run and the
    // order would be left to the sort. Comparing them brings the pair back as
    // the tie it is.
    expect(compareValues(Infinity, Infinity, "asc", EN)).toBe(0);
    expect(compareValues(Infinity, Infinity, "desc", EN)).toBe(0);
    expect(compareValues(-Infinity, -Infinity, "asc", EN)).toBe(0);

    // And the ordinary ordering against a finite value still holds.
    expect(compareValues(Infinity, 5, "asc", EN)).toBeGreaterThan(0);
    expect(compareValues(-Infinity, 5, "asc", EN)).toBeLessThan(0);
  });

  it("treats null and undefined as blank on either side", () => {
    expect(compareValues(null, "primary", "asc", EN)).toBeGreaterThan(0);
    expect(compareValues(null, "primary", "desc", EN)).toBeGreaterThan(0);
    expect(compareValues(undefined, "primary", "asc", EN)).toBeGreaterThan(0);
    expect(compareValues("primary", undefined, "desc", EN)).toBeLessThan(0);
  });

  it("produces the same order every time the same set is sorted", () => {
    expect(sortedIds(CITY_FIXTURE, "capital", "asc")).toEqual(
      sortedIds(CITY_FIXTURE, "capital", "asc"),
    );
  });

  it("returns to the first ascending order after a round trip", () => {
    const ascending = [...CITY_FIXTURE].sort(byColumn("capital", "asc"));
    const descending = [...ascending].sort(byColumn("capital", "desc"));
    const ascendingAgain = [...descending].sort(byColumn("capital", "asc"));

    expect(ascendingAgain.map((row) => row.id)).toEqual(
      ascending.map((row) => row.id),
    );
  });

  it("sorts an empty set and a single-row set without throwing", () => {
    expect(sortedIds([], "name", "asc")).toEqual([]);
    expect(sortedIds([FIRST_CITY], "name", "asc")).toEqual([FIRST_CITY.id]);
  });

  // The reason the collator is a parameter at all. Under the previous
  // module-scope constant this pair had exactly one order, whichever the
  // machine running the code happened to produce, and no argument could change
  // it.
  it("orders a pair differently under two tags", () => {
    const spanish = compareValues(TILDE, PLAIN, "asc", collatorFor("es-ES"));
    const english = compareValues(TILDE, PLAIN, "asc", collatorFor("en-US"));
    const french = compareValues(TILDE, PLAIN, "asc", collatorFor("fr-FR"));

    expect(Math.sign(spanish)).toBe(-Math.sign(english));
    expect(Math.sign(french)).toBe(Math.sign(english));

    // And the direction flip still applies to whichever order the tag gave.
    expect(
      Math.sign(compareValues(TILDE, PLAIN, "desc", collatorFor("es-ES"))),
    ).toBe(-Math.sign(spanish));
  });

  // Naming the base tag where the collator previously named nothing moves no
  // row. The runner's own default resolves to the base tag, so the two answers
  // agree here; on a machine where they did not, this suite would have been
  // reporting a different order all along.
  it("agrees in sign with the locale-less comparison it replaces", () => {
    for (const left of COLLATION_SAMPLE) {
      for (const right of COLLATION_SAMPLE) {
        if (left === right) continue;

        const comparison = compareValues(left, right, "asc", EN);

        expect(Math.sign(comparison)).toBe(
          Math.sign(left.localeCompare(right)),
        );
      }
    }
  });
});

describe("the city row identity", () => {
  /**
   * The two rows the parse boundary numbers itself, against a row carrying a
   * geoname id. Both are shorter than every other id in the dataset, and as raw
   * text a shorter id orders by its first digit and not by its magnitude. The
   * case is written from the ids alone, because the fixture carries no short id
   * and so cannot fail this on its own.
   */
  const SHORT_IDS = [1, 2];
  const asRow = (id: number) => ({ ...FIRST_CITY, id });

  it("orders as the number does, so the lowest ids do not sort last", () => {
    const geonameId = FIRST_CITY.id;

    for (const short of SHORT_IDS) {
      expect(short).toBeLessThan(geonameId);

      expect(
        compareIdentities(cityRowId(asRow(short)), cityRowId(asRow(geonameId))),
      ).toBeLessThan(0);
    }
  });

  it("has a case that fails without the padding", () => {
    const geonameId = FIRST_CITY.id;

    // Not every short id inverts: geoname ids begin with 1, so raw "1" is a
    // prefix of one and still sorts first. Id 2 is the one that moves, and one
    // inverted pair is all it takes to reorder every group of tied rows around
    // it. Asserted so a fixture whose ids stopped beginning with 1 reports that
    // this case has gone quiet instead of passing on nothing.
    const inverts = SHORT_IDS.filter(
      (short) => String(short) > String(geonameId),
    );

    expect(inverts).toEqual([2]);

    for (const short of inverts) {
      expect(
        compareIdentities(cityRowId(asRow(short)), cityRowId(asRow(geonameId))),
      ).toBeLessThan(0);
    }
  });

  it("stays unique across the ids it pads", () => {
    const rows = [...SHORT_IDS, FIRST_CITY.id].map((id) => ({
      ...FIRST_CITY,
      id,
    }));

    expect(new Set(rows.map(cityRowId)).size).toBe(rows.length);
  });
});
