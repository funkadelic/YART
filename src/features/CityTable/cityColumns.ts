import type { City } from "../../api/getCities";
import { columns } from "../../components/DataTable/column";
import type { Catalog } from "../../i18n/catalogs/en";
import { en } from "../../i18n/catalogs/en";
import { collatorFor, numberFormatFor } from "../../i18n/format";
import { resolveLocale } from "../../i18n/resolveLocale";

/**
 * The columns the city table shows, built for one resolved locale: both the
 * label and the grouped population cell follow the reader, and the collator is
 * fused into the default comparator here. A new identity every call, which is
 * the hazard: the caller memoizes on the catalog and the tag, or the sort and
 * page memos downstream re-run on every render.
 */
export function buildCityColumns(catalog: Catalog, tag: string) {
  const col = columns<City>(collatorFor(tag));
  const number = numberFormatFor(tag);

  return [
    col.key("name", { label: catalog.columnName }),
    col.key("country", { label: catalog.columnCountry }),
    col.key("capital", { label: catalog.columnCapital }),
    col.key("countryIso3", { label: catalog.columnCountryCode }),
    col.key("population", {
      label: catalog.columnPopulation,
      numeric: true,
      renderCell: (value) => number.format(value),
    }),
  ];
}

/**
 * One build at module scope, for the id union and the closed set below and for
 * nothing else. Which columns exist is the same in every language; only what
 * they are called moves.
 */
const BASE_COLUMNS = buildCityColumns(en, resolveLocale("en", []).tag);

/** The literal union of the ids above, formed with no assertion anywhere. */
export type CityColumnId = (typeof BASE_COLUMNS)[number]["id"];

/** The closed set a restored sort id is checked against, derived not listed. */
export const CITY_COLUMN_IDS: readonly CityColumnId[] = BASE_COLUMNS.map(
  (column) => column.id,
);

/** Ten, because the dataset's geoname ids are ten digits. */
const ID_WIDTH = 10;

/** Text, because the tiebreak compares text. Padded so "2" precedes "19". */
export const cityRowId = (city: City) =>
  String(city.id).padStart(ID_WIDTH, "0");
