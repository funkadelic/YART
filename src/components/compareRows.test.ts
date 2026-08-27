import { describe, expect, it } from "vitest";

import type { City } from "../api/getCities";
import { cityRowId } from "../features/CityTable/cityColumns";
import { CITY_FIXTURE } from "../test/cityFixture";
import { required } from "../test/required";
import { compareIdentities } from "./DataTable/sortRows";
import { compareValues } from "./compareRows";

const BLANK_CAPITAL = CITY_FIXTURE.filter((city) => city.capital === "");
const PRIMARY_CAPITAL = CITY_FIXTURE.filter(
  (city) => city.capital === "primary",
);
const ZERO_POPULATION = CITY_FIXTURE.filter((city) => city.population === 0);
// Picked once here rather than indexed at each case below, so the cases read as
// the comparison they are testing. The first case in the block asserts the
// counts these three depend on.
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
 * field that is sometimes text and sometimes a number, so the comparator's null
 * and mixed-type arms cannot be reached with a correctly typed row at all. They
 * exist for the point at which the table becomes generic over its row type and
 * that parse-time guarantee stops covering the input, and this is the single
 * place that hands the comparator what such input looks like.
 */
function rowWithCapital(id: number, capital: unknown): City {
  return { ...CITY_FIXTURE[0], id, capital } as City;
}

/**
 * The comparator no longer sees a row, so the identity tiebreak it used to
 * apply is applied here instead. Both halves are the shipping functions rather
 * than a local restatement of them: a restatement passes while the product
 * orders rows differently, which is the failure this composition exists to make
 * impossible. Every expected order below is the order the application produces.
 */
function byColumn(column: keyof City, direction: "asc" | "desc") {
  return (a: City, b: City): number => {
    const comparison = compareValues(a[column], b[column], direction);
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
      compareValues(BLANK.capital, PRIMARY.capital, "asc"),
    ).toBeGreaterThan(0);
    expect(compareValues(PRIMARY.capital, BLANK.capital, "asc")).toBeLessThan(
      0,
    );
  });

  it("orders a blank value last when sorting descending as well", () => {
    expect(
      compareValues(BLANK.capital, PRIMARY.capital, "desc"),
    ).toBeGreaterThan(0);
    expect(compareValues(PRIMARY.capital, BLANK.capital, "desc")).toBeLessThan(
      0,
    );
  });

  it("reports two blank values as equal in both directions", () => {
    // The pair used to come back separated by the row-id difference. Identity
    // is not a value, so the ordering half of this case now lives beside the
    // sort module; what is left here is the value-level fact it rested on.
    const first = required(BLANK_CAPITAL[0], "the first blank-capital row");
    const second = required(BLANK_CAPITAL[1], "the second blank-capital row");

    expect(compareValues(first.capital, second.capital, "asc")).toBe(0);
    expect(compareValues(first.capital, second.capital, "desc")).toBe(0);
  });

  it("treats a zero as the smallest number rather than as a blank", () => {
    expect(
      compareValues(ZERO.population, LARGEST_POPULATION.population, "asc"),
    ).toBeLessThan(0);
    expect(
      compareValues(ZERO.population, LARGEST_POPULATION.population, "desc"),
    ).toBeGreaterThan(0);
  });

  it("reports two equal values as equal in both directions", () => {
    const first = required(PRIMARY_CAPITAL[0], "the first primary-capital row");
    const second = required(
      PRIMARY_CAPITAL[1],
      "the second primary-capital row",
    );

    expect(compareValues(first.capital, second.capital, "asc")).toBe(0);
    expect(compareValues(first.capital, second.capital, "desc")).toBe(0);
  });

  it("gives a string paired with a number a defined order", () => {
    const forward = compareValues("primary", 42, "asc");
    const backward = compareValues(42, "primary", "asc");

    expect(forward).not.toBe(0);
    expect(Math.sign(backward)).toBe(-Math.sign(forward));
  });

  it("orders a mixed-type column without a cycle", () => {
    // Deciding a numeric pair by subtraction and a stringified pair by
    // collation is enough to produce 9 < 10 < "5" < 9, which the sort is free
    // to resolve however it likes. Ranking by type first is what rules it out.
    const nine = rowWithCapital(1, 9);
    const ten = rowWithCapital(2, 10);
    const five = rowWithCapital(3, "5");
    const rows = [nine, ten, five];

    for (const pair of [
      [nine, ten],
      [ten, five],
      [nine, five],
    ] as const) {
      const forward = compareValues(pair[0].capital, pair[1].capital, "asc");
      const backward = compareValues(pair[1].capital, pair[0].capital, "asc");
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
      compareValues(notANumber.capital, small.capital, "asc"),
    ).toBeGreaterThan(0);
    expect(
      compareValues(notANumber.capital, small.capital, "desc"),
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
    // order would be left to the sort. Comparing rather than subtracting is
    // what makes the pair come back as the tie it is.
    expect(compareValues(Infinity, Infinity, "asc")).toBe(0);
    expect(compareValues(Infinity, Infinity, "desc")).toBe(0);
    expect(compareValues(-Infinity, -Infinity, "asc")).toBe(0);

    // And the ordinary ordering against a finite value still holds.
    expect(compareValues(Infinity, 5, "asc")).toBeGreaterThan(0);
    expect(compareValues(-Infinity, 5, "asc")).toBeLessThan(0);
  });

  it("treats null and undefined as blank on either side", () => {
    expect(compareValues(null, "primary", "asc")).toBeGreaterThan(0);
    expect(compareValues(null, "primary", "desc")).toBeGreaterThan(0);
    expect(compareValues(undefined, "primary", "asc")).toBeGreaterThan(0);
    expect(compareValues("primary", undefined, "desc")).toBeLessThan(0);
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

  it("agrees in sign with the per-call comparison it replaces", () => {
    for (const left of COLLATION_SAMPLE) {
      for (const right of COLLATION_SAMPLE) {
        if (left === right) continue;

        const comparison = compareValues(left, right, "asc");

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
   * text a shorter id orders by its first digit rather than its magnitude. The
   * case is written from the ids alone rather than from fixture rows, because
   * the fixture carries no short id and so cannot fail this on its own.
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
    // it. Asserted so a fixture whose ids stopped beginning with 1 would report
    // that this case had gone quiet rather than passing on nothing.
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
