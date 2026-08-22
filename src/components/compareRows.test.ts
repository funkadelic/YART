import { describe, expect, it } from "vitest";

import type { City } from "../api/getCities";
import { CITY_FIXTURE } from "../test/cityFixture";
import { compareRows } from "./compareRows";

const BLANK_CAPITAL = CITY_FIXTURE.filter((city) => city.capital === "");
const PRIMARY_CAPITAL = CITY_FIXTURE.filter(
  (city) => city.capital === "primary",
);
const ZERO_POPULATION = CITY_FIXTURE.filter((city) => city.population === 0);
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

function sortedIds(
  rows: City[],
  column: keyof City,
  direction: "asc" | "desc",
): number[] {
  return [...rows]
    .sort((a, b) => compareRows(a, b, column, direction))
    .map((row) => row.id);
}

describe("compareRows", () => {
  it("has a fixture that still carries the rows these cases need", () => {
    expect(BLANK_CAPITAL.length).toBeGreaterThanOrEqual(2);
    expect(PRIMARY_CAPITAL.length).toBeGreaterThanOrEqual(2);
    expect(ZERO_POPULATION.length).toBeGreaterThanOrEqual(1);
  });

  it("orders a blank value last when sorting ascending", () => {
    expect(
      compareRows(BLANK_CAPITAL[0], PRIMARY_CAPITAL[0], "capital", "asc"),
    ).toBeGreaterThan(0);
    expect(
      compareRows(PRIMARY_CAPITAL[0], BLANK_CAPITAL[0], "capital", "asc"),
    ).toBeLessThan(0);
  });

  it("orders a blank value last when sorting descending as well", () => {
    expect(
      compareRows(BLANK_CAPITAL[0], PRIMARY_CAPITAL[0], "capital", "desc"),
    ).toBeGreaterThan(0);
    expect(
      compareRows(PRIMARY_CAPITAL[0], BLANK_CAPITAL[0], "capital", "desc"),
    ).toBeLessThan(0);
  });

  it("orders two blank values by ascending row id in both directions", () => {
    const [first, second] = BLANK_CAPITAL;
    const idDifference = first.id - second.id;

    expect(compareRows(first, second, "capital", "asc")).toBe(idDifference);
    expect(compareRows(first, second, "capital", "desc")).toBe(idDifference);
  });

  it("treats a zero as the smallest number rather than as a blank", () => {
    expect(
      compareRows(ZERO_POPULATION[0], LARGEST_POPULATION, "population", "asc"),
    ).toBeLessThan(0);
    expect(
      compareRows(ZERO_POPULATION[0], LARGEST_POPULATION, "population", "desc"),
    ).toBeGreaterThan(0);
  });

  it("orders two equal values by ascending row id in both directions", () => {
    const [first, second] = PRIMARY_CAPITAL;
    const idDifference = first.id - second.id;

    expect(compareRows(first, second, "capital", "asc")).toBe(idDifference);
    expect(compareRows(first, second, "capital", "desc")).toBe(idDifference);
  });

  it("gives a string paired with a number a defined order", () => {
    const text = rowWithCapital(1, "primary");
    const number = rowWithCapital(2, 42);

    const forward = compareRows(text, number, "capital", "asc");
    const backward = compareRows(number, text, "capital", "asc");

    expect(forward).not.toBe(0);
    expect(Math.sign(backward)).toBe(-Math.sign(forward));
  });

  it("treats null and undefined as blank on either side", () => {
    const absent = rowWithCapital(1, null);
    const missing = rowWithCapital(2, undefined);
    const present = rowWithCapital(3, "primary");

    expect(compareRows(absent, present, "capital", "asc")).toBeGreaterThan(0);
    expect(compareRows(absent, present, "capital", "desc")).toBeGreaterThan(0);
    expect(compareRows(missing, present, "capital", "asc")).toBeGreaterThan(0);
    expect(compareRows(present, missing, "capital", "desc")).toBeLessThan(0);
  });

  it("produces the same order every time the same set is sorted", () => {
    expect(sortedIds(CITY_FIXTURE, "capital", "asc")).toEqual(
      sortedIds(CITY_FIXTURE, "capital", "asc"),
    );
  });

  it("returns to the first ascending order after a round trip", () => {
    const ascending = [...CITY_FIXTURE].sort((a, b) =>
      compareRows(a, b, "capital", "asc"),
    );
    const descending = [...ascending].sort((a, b) =>
      compareRows(a, b, "capital", "desc"),
    );
    const ascendingAgain = [...descending].sort((a, b) =>
      compareRows(a, b, "capital", "asc"),
    );

    expect(ascendingAgain.map((row) => row.id)).toEqual(
      ascending.map((row) => row.id),
    );
  });

  it("sorts an empty set and a single-row set without throwing", () => {
    expect(sortedIds([], "name", "asc")).toEqual([]);
    expect(sortedIds([CITY_FIXTURE[0]], "name", "asc")).toEqual([
      CITY_FIXTURE[0].id,
    ]);
  });

  it("agrees in sign with the per-call comparison it replaces", () => {
    for (const left of COLLATION_SAMPLE) {
      for (const right of COLLATION_SAMPLE) {
        if (left === right) continue;

        const comparison = compareRows(
          rowWithCapital(1, left),
          rowWithCapital(2, right),
          "capital",
          "asc",
        );

        expect(Math.sign(comparison)).toBe(
          Math.sign(left.localeCompare(right)),
        );
      }
    }
  });
});
