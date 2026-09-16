// Sorting, which is the most expensive thing either table does. A click on a
// header orders the whole matched set before a page is sliced out of it, so the
// cost here is paid on the reader's click and not on a background pass.
//
// The comparators are the shipping ones: both column builders are called, so a
// change to the collated default, to the numeric arm or to the film table's
// list comparator moves these numbers.

import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

import { sortRows } from "../src/components/DataTable/sortRows";
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
import { report } from "./harness";

// Ten thousand rather than the fifty thousand the city asset carries: the
// shipped dataset only reaches the sort once a search has narrowed it, and a
// fifth of it is wide enough that the comparison dominates the call while
// leaving the benchmark quick enough to run on every commit.
const ROWS = 10_000;

const { tag } = resolveLocale("en", []);
const cities = cityRows(ROWS);
const films = filmRows(ROWS);
const cityColumns = buildCityColumns(en, tag);
const filmColumns = buildFilmColumns(en, tag);

/** A column of the built array, located the way the table's sort hook does. */
function cityColumn(id: string) {
  return cityColumns.find((column) => column.id === id);
}

function filmColumn(id: string) {
  return filmColumns.find((column) => column.id === id);
}

const bench = withCodSpeed(new Bench());

bench
  // The collated default, over the column a reader sorts first.
  .add(`sort ${ROWS} cities by name, ascending`, () => {
    sortRows(cities, cityColumn("name"), "asc", cityRowId);
  })
  // The same comparator the other way, so a flip that stopped being free would
  // show up separately from the comparison itself.
  .add(`sort ${ROWS} cities by name, descending`, () => {
    sortRows(cities, cityColumn("name"), "desc", cityRowId);
  })
  // The numeric arm, which never reaches the collator and carries the blank
  // rows the fixture keeps at zero population.
  .add(`sort ${ROWS} cities by population, descending`, () => {
    sortRows(cities, cityColumn("population"), "desc", cityRowId);
  })
  // A column whose values repeat across the whole set, so almost every
  // comparison falls through to the identity tiebreak.
  .add(`sort ${ROWS} cities by capital class, ascending`, () => {
    sortRows(cities, cityColumn("capital"), "asc", cityRowId);
  })
  .add(`sort ${ROWS} films by title, ascending`, () => {
    sortRows(films, filmColumn("title"), "asc", filmRowId);
  })
  // The film table's own comparator: a list column joins its items before it
  // collates them, and orders an empty list last.
  .add(`sort ${ROWS} films by genres, ascending`, () => {
    sortRows(films, filmColumn("genres"), "asc", filmRowId);
  });

await bench.run();
report(bench);
