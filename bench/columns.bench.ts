// The column arrays and the cells they render. Both builders run again
// whenever the reader changes language, and every cell of the visible page is
// rendered again on every sort, every page press and every settled keystroke.

import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

import type { City } from "../src/api/getCities";
import { columns } from "../src/components/DataTable/column";
import { buildCityColumns } from "../src/features/CityTable/cityColumns";
import { buildFilmColumns } from "../src/features/FilmTable/filmColumns";
import { CATALOGS } from "../src/i18n/catalogs";
import { en } from "../src/i18n/catalogs/en";
import { collatorFor } from "../src/i18n/format";
import { CATALOG_IDS, resolveLocale } from "../src/i18n/resolveLocale";
import { cityRows, filmRows } from "./fixtures";
import { ROUNDS, report, rounds } from "./harness";

/** The largest page the size control offers, which is the widest render. */
const PAGE_SIZE = 100;

const { tag } = resolveLocale("en", []);
const cityPage = cityRows(PAGE_SIZE);
const filmPage = filmRows(PAGE_SIZE);
const cityColumns = buildCityColumns(en, tag);
const filmColumns = buildFilmColumns(en, tag);

/** Every cell of a page, which is what the body renders between two states. */
function renderPage<T>(
  rows: readonly T[],
  built: readonly { renderCell: (row: T) => unknown }[],
): void {
  for (const row of rows) {
    for (const column of built) {
      column.renderCell(row);
    }
  }
}

const bench = withCodSpeed(new Bench());

bench
  // One language change: both arrays are rebuilt, and with them the collator
  // lookup and the formatter each cell renderer closes over.
  .add(`build both column arrays for one locale, ${ROUNDS} rounds`, () => {
    rounds(() => {
      buildCityColumns(en, tag);
      buildFilmColumns(en, tag);
    });
  })
  // Every catalog that ships, which is the language picker walked end to end.
  .add(`build both column arrays for every catalog, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const id of CATALOG_IDS) {
        const resolved = resolveLocale(id, []);
        buildCityColumns(CATALOGS[id], resolved.tag);
        buildFilmColumns(CATALOGS[id], resolved.tag);
      }
    });
  })
  // The grouped population cell is the formatting in this page; the other four
  // columns take the default renderer.
  .add(`render a ${PAGE_SIZE}-row page of city cells`, () => {
    renderPage(cityPage, cityColumns);
  })
  // Three list columns and a runtime carrying its unit, so this page is four
  // formatted cells a row against the city table's one.
  .add(`render a ${PAGE_SIZE}-row page of film cells`, () => {
    renderPage(filmPage, filmColumns);
  })
  // The factory itself, away from either table's column list: one builder, the
  // duplicate-id set it keeps, and the two ways a column is declared.
  .add(`build a column array through the factory, ${ROUNDS} rounds`, () => {
    rounds(() => {
      const col = columns<City>(collatorFor(tag));
      col.key("name", { label: "City" });
      col.key("population", { label: "Population", numeric: true });
      col.accessor("initial", (row) => row.name.charAt(0), {
        label: "Initial",
      });
    });
  });

await bench.run();
report(bench);
