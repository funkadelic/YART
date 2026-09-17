// The column arrays, rebuilt on a language change, and the cells of one page.

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

/** The largest page size the control offers. */
const PAGE_SIZE = 100;

const { tag } = resolveLocale("en", []);
const cityPage = cityRows(PAGE_SIZE);
const filmPage = filmRows(PAGE_SIZE);
const cityColumns = buildCityColumns(en, tag);
const filmColumns = buildFilmColumns(en, tag);

/** Renders every cell of a page. */
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
  .add(`build both column arrays for one locale, ${ROUNDS} rounds`, () => {
    rounds(() => {
      buildCityColumns(en, tag);
      buildFilmColumns(en, tag);
    });
  })
  .add(`build both column arrays for every catalog, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const id of CATALOG_IDS) {
        const resolved = resolveLocale(id, []);
        buildCityColumns(CATALOGS[id], resolved.tag);
        buildFilmColumns(CATALOGS[id], resolved.tag);
      }
    });
  })
  .add(`render a ${PAGE_SIZE}-row page of city cells`, () => {
    renderPage(cityPage, cityColumns);
  })
  .add(`render a ${PAGE_SIZE}-row page of film cells`, () => {
    renderPage(filmPage, filmColumns);
  })
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
