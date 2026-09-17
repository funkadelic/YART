// The sort a header click runs, through both tables' shipping comparators.

import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

import { sortRows } from "../src/components/DataTable/sortRows";
import { sortRowsCached } from "../src/components/DataTable/sortRowsCached";
import { sortRowsSliced } from "../src/components/DataTable/sortRowsSliced";
import {
  buildCityColumns,
  cityRowId,
} from "../src/features/CityTable/cityColumns";
import {
  buildFilmColumns,
  filmRowId,
} from "../src/features/FilmTable/filmColumns";
import { en } from "../src/i18n/catalogs/en";
import { resolveLocale } from "../src/i18n/resolveLocale";
import { cityRows, filmRows } from "./fixtures";
import { report, rounds } from "./harness";

/** Each shipped dataset's full size, which a click on the unfiltered page sorts. */
const CITY_ROWS = 50_250;
const FILM_ROWS = 8_945;

const { tag } = resolveLocale("en", []);
const cities = cityRows(CITY_ROWS);
const films = filmRows(FILM_ROWS);
const cityColumns = buildCityColumns(en, tag);
const filmColumns = buildFilmColumns(en, tag);

/** A city column, looked up the way the table's sort hook does. */
function cityColumn(id: string) {
  return cityColumns.find((column) => column.id === id);
}

/** A film column, looked up the way the table's sort hook does. */
function filmColumn(id: string) {
  return filmColumns.find((column) => column.id === id);
}

/** The name column, defined, as the sliced sort requires. */
const cityName = cityColumn("name");
if (!cityName) throw new Error("the city name column is missing");

/** About the size a one-word search returns. */
const citySubset = cities.filter((_, at) => at % 30 === 0);

// Warmed outside the tasks, so each cached case measures reuse.
sortRowsCached(cities, cityColumn("name"), "asc", cityRowId);

const bench = withCodSpeed(new Bench());

bench
  .add(`sort ${CITY_ROWS} cities by name, ascending`, () => {
    sortRows(cities, cityColumn("name"), "asc", cityRowId);
  })
  .add(`sort ${CITY_ROWS} cities by name, descending`, () => {
    sortRows(cities, cityColumn("name"), "desc", cityRowId);
  })
  .add(`sort ${CITY_ROWS} cities by name across frames`, async () => {
    await sortRowsSliced(cities, cityName, "asc", cityRowId, () => false);
  })
  // Numeric, so the collator is never reached.
  .add(`sort ${CITY_ROWS} cities by population, descending`, () => {
    sortRows(cities, cityColumn("population"), "desc", cityRowId);
  })
  // Three repeating values, so most comparisons fall to the identity tiebreak.
  .add(`sort ${CITY_ROWS} cities by capital class, ascending`, () => {
    sortRows(cities, cityColumn("capital"), "asc", cityRowId);
  })
  .add(`sort ${FILM_ROWS} films by title, ascending`, () => {
    sortRows(films, filmColumn("title"), "asc", filmRowId);
  })
  // The list comparator, which joins items before collating.
  .add(`sort ${FILM_ROWS} films by genres, ascending`, () => {
    sortRows(films, filmColumn("genres"), "asc", filmRowId);
  })
  // A hit is a lookup costing microseconds, so it runs in rounds.
  .add(`repeat sort of ${CITY_ROWS} cities by name (cached)`, () => {
    rounds(() => {
      sortRowsCached(cities, cityColumn("name"), "asc", cityRowId);
    });
  })
  .add(
    `sort a ${citySubset.length}-row subset by name from the cached order`,
    () => {
      sortRowsCached(citySubset, cityColumn("name"), "asc", cityRowId);
    },
  );

await bench.run();
report(bench);
